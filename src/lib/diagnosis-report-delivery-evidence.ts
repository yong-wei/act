import type { CaptureRevisionProof } from '@/lib/commercial-ui-capture-revision';

export function assertDiagnosisDeliveryCaptureProofMatches(
  expected: CaptureRevisionProof,
  actual: CaptureRevisionProof,
  phase: string,
) {
  if (!actual.clean) {
    throw new Error(`${phase}: diagnosis delivery capture service is dirty.`);
  }
  for (const field of ['commitSha', 'treeSha', 'sourceFingerprint'] as const) {
    if (actual[field] !== expected[field]) {
      throw new Error(
        `${phase}: diagnosis delivery capture service ${field} mismatch; expected=${expected[field]} actual=${actual[field]}`,
      );
    }
  }
}
