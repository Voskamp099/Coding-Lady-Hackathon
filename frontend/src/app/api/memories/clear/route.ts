import { NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backend-config';

export async function POST() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/memories/clear`, {
      method: 'POST',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: `Backend unreachable: ${err.message}` },
      { status: 502 }
    );
  }
}
