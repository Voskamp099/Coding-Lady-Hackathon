import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backend-config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '100';
    const res = await fetch(`${BACKEND_URL}/api/memories/list?limit=${limit}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { count: 0, memories: [], error: `Backend unreachable: ${err.message}` },
      { status: 502 }
    );
  }
}
