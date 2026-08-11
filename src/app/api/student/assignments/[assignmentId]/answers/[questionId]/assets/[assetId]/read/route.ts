import { NextResponse } from 'next/server';
import { SubmissionError } from '@/lib/assignments/submission-domain';
import { assertSubmissionObjectIntegrity } from '@/lib/assignments/submission-integrity';
import { createSubmissionObjectStore } from '@/lib/assignments/submission-object-store';
import { consumeSubmissionAssetRead, signSubmissionAssetRead } from '@/lib/assignments/submission-service';
import { requireStudentActor, submissionErrorResponse } from '@/lib/assignments/submission-route-guards';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string; questionId: string; assetId: string }> }) {
  const auth = await requireStudentActor(); if ('response' in auth) return auth.response;
  const origin = request.headers.get('origin'); if (!origin || origin !== new URL(process.env.NEXTAUTH_URL ?? request.url).origin) return NextResponse.json({ error: 'invalid-origin' }, { status: 403 });
  try { const ids = await params; return NextResponse.json({ access: await signSubmissionAssetRead(prisma, { studentId: auth.actor.id, ...ids }) }); } catch (error) { rethrowIfNextDynamicError(error); return submissionErrorResponse(error); }
}

export async function GET(request: Request, { params }: { params: Promise<{ assignmentId: string; questionId: string; assetId: string }> }) {
  const auth = await requireStudentActor(); if ('response' in auth) return auth.response;
  try {
    const ids = await params; const token = new URL(request.url).searchParams.get('token') ?? '';
    const asset = await consumeSubmissionAssetRead(prisma, { studentId: auth.actor.id, ...ids, token });
    const bytes = await createSubmissionObjectStore().readObject(asset.objectKey);
    if (!asset.checksum) throw new SubmissionError('submission-content-unavailable', 410);
    assertSubmissionObjectIntegrity(bytes, asset.sizeBytes, asset.checksum);
    const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(asset.displayName)}`;
    return new NextResponse(Buffer.from(bytes), { status: 200, headers: { 'Content-Type': asset.mimeType, 'Content-Length': String(bytes.byteLength), 'Content-Disposition': disposition, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' } });
  } catch (error) { rethrowIfNextDynamicError(error); return submissionErrorResponse(error); }
}
