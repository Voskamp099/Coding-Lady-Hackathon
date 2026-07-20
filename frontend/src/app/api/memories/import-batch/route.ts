import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backend-config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const res = await fetch(`${BACKEND_URL}/api/memories/import-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, imported: 0, message: `Backend unreachable: ${err.message}` },
      { status: 502 }
    );
  }
}
