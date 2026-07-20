import { NextRequest, NextResponse } from 'next/server';
import { BACKEND_URL } from '@/lib/backend-config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const scope = body.scope || 'all';
    const childName = body.child_name || '';
    const res = await fetch(`${BACKEND_URL}/api/analysis/values?scope=${scope}${childName ? `&child_name=${encodeURIComponent(childName)}` : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, values: [], trend: '', message: `Backend unreachable: ${err.message}` },
      { status: 502 }
    );
  }
}
