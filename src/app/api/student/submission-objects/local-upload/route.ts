import { NextResponse } from 'next/server';
import { getLocalTestSubmissionObjectStore } from '@/lib/assignments/submission-object-store';
import { SUBMISSION_LIMITS, SubmissionError } from '@/lib/assignments/submission-domain';
import { submissionErrorResponse } from '@/lib/assignments/submission-route-guards';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  try {
    const url = new URL(request.url); const key = url.searchParams.get('key') ?? ''; const signature = url.searchParams.get('signature') ?? ''; const expires = Number(url.searchParams.get('expires'));
    const declared = Number(request.headers.get('content-length')); if (!Number.isInteger(declared) || declared < 1 || declared > SUBMISSION_LIMITS.file) throw new SubmissionError('invalid-content-length', 413);
    const bytes = new Uint8Array(await request.arrayBuffer()); if (bytes.byteLength !== declared) throw new SubmissionError('content-length-mismatch', 409);
    getLocalTestSubmissionObjectStore().acceptSignedUpload({ key, signature, expires, bytes, mimeType: request.headers.get('content-type') ?? '', checksumBase64: request.headers.get('x-amz-checksum-sha256') ?? '' });
    return new NextResponse(null, { status: 204 });
  } catch (error) { rethrowIfNextDynamicError(error); return submissionErrorResponse(error); }
}
