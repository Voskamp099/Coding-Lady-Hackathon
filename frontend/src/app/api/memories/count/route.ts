import { NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backend-config';

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/memories/count`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { count: 0, error: `Backend unreachable: ${err.message}` },
      { status: 502 }
    );
  }
}
