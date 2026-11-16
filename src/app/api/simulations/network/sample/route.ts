import { NextResponse } from 'next/server';
import { randomFillSync } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const BANDWIDTH_SAMPLE_BYTES = 2 * 1024 * 1024;
const payload = randomFillSync(Buffer.alloc(BANDWIDTH_SAMPLE_BYTES));

export function GET() {
  return new NextResponse(payload, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(BANDWIDTH_SAMPLE_BYTES),
      'Cache-Control': 'no-store, no-transform',
    },
  });
}
