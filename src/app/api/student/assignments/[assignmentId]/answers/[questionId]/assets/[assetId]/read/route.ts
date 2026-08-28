import { NextResponse } from 'next/server';
import { studentReadQuestionAsset, studentSignQuestionAssetRead } from '@/lib/assignments/public-api';
import { requireStudentActor, submissionErrorResponse } from '@/lib/assignments/submission-route-guards';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string; questionId: string; assetId: string }> }) {
  const auth = await requireStudentActor(); if ('response' in auth) return auth.response;
  const origin = request.headers.get('origin'); if (!origin || origin !== new URL(process.env.NEXTAUTH_URL ?? request.url).origin) return NextResponse.json({ error: 'invalid-origin' }, { status: 403 });
  try { const ids = await params; return NextResponse.json({ access: await studentSignQuestionAssetRead(auth.actor, ids) }); } catch (error) { rethrowIfNextDynamicError(error); return submissionErrorResponse(error); }
}

export async function GET(request: Request, { params }: { params: Promise<{ assignmentId: string; questionId: string; assetId: string }> }) {
  const auth = await requireStudentActor(); if ('response' in auth) return auth.response;
  try {
    const ids = await params; const token = new URL(request.url).searchParams.get('token') ?? '';
    const asset = await studentReadQuestionAsset(auth.actor, { ...ids, token });
    const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(asset.displayName)}`;
    return new NextResponse(Buffer.from(asset.bytes), { status: 200, headers: { 'Content-Type': asset.mimeType, 'Content-Length': String(asset.sizeBytes), 'Content-Disposition': disposition, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } });
  } catch (error) { rethrowIfNextDynamicError(error); return submissionErrorResponse(error); }
}
