import { NextResponse } from 'next/server';
import { simulationAdmission } from '@/lib/simulation-admission';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function DELETE() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: '正式环境不提供清空名额。' }, { status: 404 });
  }
  simulationAdmission.reset();
  return NextResponse.json(simulationAdmission.snapshot());
}

export function GET() {
  return NextResponse.json(simulationAdmission.snapshot(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { clientId?: unknown };
  const clientId = typeof body.clientId === 'string' && body.clientId.trim()
    ? body.clientId.trim().slice(0, 80)
    : `guest-${crypto.randomUUID()}`;
  return NextResponse.json(simulationAdmission.request(clientId), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
