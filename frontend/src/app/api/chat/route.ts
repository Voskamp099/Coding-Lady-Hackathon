import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backend-config';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  childName?: string;
  memoryContext?: string;
  userRole?: 'parent' | 'child';
}

/**
 * Chat API route — calls the Python backend's conversational Agent (Agent 2).
 *
 * Flow:
 *   Frontend chat page → this route → Python /api/chat → SSE stream back
 *
 * The Python backend runs the full analysis pipeline:
 *   retrieve memories → Layer3 value synthesis → RAG knowledge → LLM analysis
 *
 * We convert the JSON response to SSE chunks for the frontend's streaming UI.
 */
export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { messages, childName = '宝宝', memoryContext = '', userRole = 'parent' } = body;

    // Extract the latest user message
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) {
      return NextResponse.json({ error: 'No user message' }, { status: 400 });
    }

    // Build the enriched message for the Python backend.
    // 用隐式叙述而非"对话上下文"标签（避免 LLM 复读前缀）
    const perspectiveNote = userRole === 'parent'
      ? `家长视角：用第三人称谈论孩子「${childName}」`
      : `孩子视角：用第二人称跟「${childName}」本人对话`;
    const enrichedMessage = [
      `（${perspectiveNote}）`,
      memoryContext ? `\n以下是用户过往的真实成长记录，作为你回答的事实基础（不要复述格式）：\n${memoryContext.slice(0, 1500)}` : '',
      `\n\n用户当前的问题：${lastUserMsg.content}`,
    ].filter(Boolean).join('\n');

    // Call Python backend chat agent
    const backendRes = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: enrichedMessage,
        k: 10,
        with_evidence: false,
        child_name: childName,  // 透传到后端做按名字的检索隔离
      }),
    });

    if (!backendRes.ok) {
      const errText = await backendRes.text().catch(() => 'Backend error');
      return streamError(`后端分析失败: ${backendRes.status}`);
    }

    const backendData = await backendRes.json();
    const answer: string = backendData.answer || '抱歉，我暂时无法生成回应。';

    // Stream the answer as SSE chunks.
    // We split by sentences/segments to simulate natural streaming.
    const segments = splitIntoSegments(answer);

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for (const segment of segments) {
            const data = JSON.stringify({ content: segment });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            // Small delay between segments for natural feel
            await new Promise(resolve => setTimeout(resolve, 30));
          }
          controller.enqueue(encoder.encode(`data: {"done":true}\n\n`));
          controller.close();
        } catch {
          controller.enqueue(encoder.encode(`data: {"done":true}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: any) {
    return streamError(`服务异常: ${err.message}`);
  }
}

/**
 * Split text into streaming segments (by sentences, keeping punctuation).
 * Handles both Chinese (。！？) and English (.!?) sentence boundaries.
 */
function splitIntoSegments(text: string): string[] {
  // Split by sentence-ending punctuation, keep the punctuation
  const parts = text.split(/(?<=[。！？\n.!?])/);
  const segments: string[] = [];
  let buffer = '';

  for (const part of parts) {
    buffer += part;
    // Flush when buffer is long enough or hits a newline
    if (buffer.length >= 12 || buffer.includes('\n')) {
      segments.push(buffer);
      buffer = '';
    }
  }
  if (buffer) segments.push(buffer);
  return segments.length > 0 ? segments : [text];
}

function streamError(message: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const data = JSON.stringify({ content: message });
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      controller.enqueue(encoder.encode(`data: {"done":true}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
