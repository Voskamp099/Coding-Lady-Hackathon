import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backend-config';

/**
 * Classify-time API route — lightweight endpoint that calls the Python backend
 * to classify a memory text into one of the five time types using KB RAG.
 *
 * Flow:
 *   Frontend feed page → this route → Python /api/classify-time → JSON response
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text field' }, { status: 400 });
    }

    const backendRes = await fetch(`${BACKEND_URL}/api/classify-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!backendRes.ok) {
      return NextResponse.json(
        { success: false, type: 'play', label: '好玩', message: 'Backend error' },
        { status: 200 }
      );
    }

    const data = await backendRes.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, type: 'play', label: '好玩', message: `Service error: ${err.message}` },
      { status: 200 }
    );
  }
}
