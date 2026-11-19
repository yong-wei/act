import { getToken } from 'next-auth/jwt';
import { type NextRequest, NextResponse } from 'next/server';
import { requireVesselEvidenceAccount, vesselEvidenceErrorResponse } from '@/features/ilab/course-evidence-api';
import { updateCourseSaveAdmission } from '@/features/ilab/course-save-admission';
import { resolveNextAuthSessionCookieConfig } from '@/features/ilab/adapters/ilab-account-service';
import { IlabServiceError } from '@/features/ilab/run-lock';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

async function admissionAccount(request: NextRequest) {
  if (request.headers.get('x-act-preview') === '1') throw new IlabServiceError('当前为预览模式。', 403);
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) return requireVesselEvidenceAccount(request);
  const { cookieName, secure } = resolveNextAuthSessionCookieConfig(request);
  // NextAuth also accepts a bearer token. This route continues to require its session cookie.
  const hasCookie = request.cookies.getAll().some(({ name, value }) => value
    && (name === cookieName || (name.startsWith(`${cookieName}.`) && /^\d+$/.test(name.slice(cookieName.length + 1)))));
  const token = hasCookie ? await getToken({ req: request, secret, cookieName, secureCookie: secure }) : null;
  if (typeof token?.id !== 'string' || !token.id) throw new IlabServiceError('请先登录后保存到平台。', 401);
  return token.id;
}

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await admissionAccount(request);
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
