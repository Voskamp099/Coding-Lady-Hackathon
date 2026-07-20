import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backend-config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // 透传前端传入的所有查询参数（含 child_name）
    const qs = searchParams.toString();
    const res = await fetch(`${BACKEND_URL}/api/memories/list${qs ? `?${qs}` : ''}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { count: 0, memories: [], error: `Backend unreachable: ${err.message}` },
      { status: 502 }
    );
  }
}
