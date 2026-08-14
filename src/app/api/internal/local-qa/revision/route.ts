import { NextResponse } from 'next/server';

import { computeCaptureRevisionProof } from '@/lib/commercial-ui-capture-revision';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

// Capture the revision when the route module is loaded so later filesystem or
// Git changes cannot make an already-running service claim a different build.
let runtimeRevisionProof: ReturnType<typeof computeCaptureRevisionProof> | null = (() => {
  try {
    return computeCaptureRevisionProof();
  } catch {
    return null;
  }
})();

function getRuntimeRevisionProof() {
  if (runtimeRevisionProof) return runtimeRevisionProof;
  try {
    runtimeRevisionProof = computeCaptureRevisionProof();
    return runtimeRevisionProof;
  } catch {
    return null;
  }
}

export function resetRuntimeRevisionProofForTests() {
  runtimeRevisionProof = null;
}

export async function GET() {
  if (process.env.NODE_ENV !== 'development' || process.env.ACT_LOCAL_QA_BRIDGE !== '1') {
    return new NextResponse(null, { status: 404, headers: NO_STORE_HEADERS });
  }

  try {
    const proof = getRuntimeRevisionProof();
    if (!proof || !proof.clean) {
      return new NextResponse(null, { status: 503, headers: NO_STORE_HEADERS });
    }
    return NextResponse.json(proof, { headers: NO_STORE_HEADERS });
  } catch {
    return new NextResponse(null, { status: 503, headers: NO_STORE_HEADERS });
  }
}
