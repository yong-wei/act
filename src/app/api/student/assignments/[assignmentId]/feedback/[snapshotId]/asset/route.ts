import { studentReadFeedbackAsset } from '@/lib/assignments/public-api';
import { requireStudentActor, submissionErrorResponse } from '@/lib/assignments/submission-route-guards';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, context: { params: Promise<{ assignmentId: string; snapshotId: string }> }) {
  const auth = await requireStudentActor();
  if ('response' in auth) return auth.response;
  try {
    const { assignmentId, snapshotId } = await context.params;
    const asset = await studentReadFeedbackAsset(auth.actor, assignmentId, snapshotId);
    return new Response(asset.bytes, {
      headers: {
        'content-type': asset.mimeType,
        'content-length': String(asset.bytes.byteLength),
        'content-disposition': `attachment; filename="${asset.filename}"`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    return submissionErrorResponse(error);
  }
}
