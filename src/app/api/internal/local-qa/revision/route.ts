import { NextResponse } from 'next/server';

import { getRuntimeCaptureRevisionProof } from '@/lib/commercial-ui-capture-revision-runtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function GET() {
  if (process.env.NODE_ENV !== 'development' || process.env.ACT_LOCAL_QA_BRIDGE !== '1') {
    return new NextResponse(null, { status: 404, headers: NO_STORE_HEADERS });
  }

  try {
    const proof = getRuntimeCaptureRevisionProof();
    if (!proof || !proof.clean) {
      return new NextResponse(null, { status: 503, headers: NO_STORE_HEADERS });
    }
    return NextResponse.json(proof, { headers: NO_STORE_HEADERS });
  } catch {
    return new NextResponse(null, { status: 503, headers: NO_STORE_HEADERS });
  }
}
