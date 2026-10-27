import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const BANDWIDTH_SAMPLE_BYTES = 2 * 1024 * 1024;
const payload = Buffer.alloc(BANDWIDTH_SAMPLE_BYTES, 7);

export function GET() {
  return new NextResponse(payload, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(BANDWIDTH_SAMPLE_BYTES),
      'Cache-Control': 'no-store',
    },
  });
}
