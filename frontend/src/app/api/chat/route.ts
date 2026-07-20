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

    // 复合键 parentName::childName → 孩子名用于显示，完整键用于后端隔离
    const displayChildName = childName && childName.includes('::')
      ? childName.split('::', 1)[1]
      : childName;

    // 用户问题直接传给后端，视角信息通过 user_role 独立字段传递（后端注入 system prompt）
    const enrichedMessage = lastUserMsg.content;

    // Call Python backend chat agent (k=5, 精简检索)
    const backendRes = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: enrichedMessage,
        k: 5,
        with_evidence: false,
        child_name: childName,  // 透传到后端做按名字的检索隔离
        user_role: userRole,   // 透传视角到后端，注入 system prompt
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
            // Small delay between segments for natural feel (kept short so答复更快呈现)
            await new Promise(resolve => setTimeout(resolve, 10));
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
    // Flush when buffer is long enough or hits a newline（buffer 调大→分段更少→整体更快呈现）
    if (buffer.length >= 24 || buffer.includes('\n')) {
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
