import { computeCaptureRevisionProof } from '@/lib/commercial-ui-capture-revision';

type CaptureRevisionProof = ReturnType<typeof computeCaptureRevisionProof>;

let runtimeRevisionProof: CaptureRevisionProof | null = (() => {
  try {
    return computeCaptureRevisionProof();
  } catch {
    return null;
  }
})();

export function getRuntimeCaptureRevisionProof() {
  if (runtimeRevisionProof) return runtimeRevisionProof;
  try {
    runtimeRevisionProof = computeCaptureRevisionProof();
    return runtimeRevisionProof;
  } catch {
    return null;
  }
}

export function resetRuntimeCaptureRevisionProofForTests() {
  runtimeRevisionProof = null;
}
