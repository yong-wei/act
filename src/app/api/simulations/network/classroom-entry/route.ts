import { NextResponse } from 'next/server';
import { reserveSimulationClassroomEntry } from '@/features/simulations/adapters/classroom-admission';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  const data = await request.json().catch(() => null) as { browserId?: unknown } | null;
  if (typeof data?.browserId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(data.browserId)) {
    return NextResponse.json({ error: '无法识别本次入场请求。' }, { status: 400, headers });
  }
  try {
    const wait = await reserveSimulationClassroomEntry(data.browserId);
    return NextResponse.json({ admitted: wait === 0, retryAfterMs: wait },
      { headers });
  } catch {
    return NextResponse.json({ admitted: false, retryAfterMs: 5000, unavailable: true }, { status: 503, headers });
  }
}
