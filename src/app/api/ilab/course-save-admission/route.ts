import { NextResponse } from 'next/server';
import { requireVesselEvidenceAccount, vesselEvidenceErrorResponse } from '@/features/ilab/course-evidence-api';
import { updateCourseSaveAdmission } from '@/features/ilab/course-save-admission';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await requireVesselEvidenceAccount(request);
  } catch (error) {
    return vesselEvidenceErrorResponse(error);
  }
  const data = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (typeof data?.roundRef !== 'string' || !uuid.test(data.roundRef)
    || typeof data.worker !== 'string' || !uuid.test(data.worker)
    || (data.action !== 'reserve' && data.action !== 'renew' && data.action !== 'release')) {
    return NextResponse.json({ error: '无法识别本次保存请求。' }, { status: 400, headers });
  }
  try {
    const wait = await updateCourseSaveAdmission(userId, data.roundRef.toLowerCase(), data.worker, data.action);
    if (wait === -1) {
      return NextResponse.json({ admitted: false, retryAfterMs: 6000 }, { status: 429, headers: { ...headers, 'Retry-After': '6' } });
    }
    if (wait === -2) return NextResponse.json({ admitted: false }, { status: 409, headers });
    return NextResponse.json({ admitted: wait === 0, retryAfterMs: wait }, { status: wait ? 202 : 200, headers });
  } catch {
    return NextResponse.json({ admitted: false, retryAfterMs: 5000 }, { status: 503, headers: { ...headers, 'Retry-After': '5' } });
  }
}
