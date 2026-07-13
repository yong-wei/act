import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { redisClient } from '@/lib/redis-client';
import {
  MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_KEY,
  MATH_DOCUMENT_GRADING_WORKER_HEARTBEAT_KEY,
  isMathDocumentGradingWorkerCapabilityReady,
  parseMathDocumentGradingWorkerCapability,
  type MathDocumentGradingWorkerCapabilityStatus,
} from '@/lib/data-governance/math-document-grading-worker-readiness';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const timestamp = new Date().toISOString();

  let db = false;
  let redis = false;
  const workerRequired = ['1', 'true', 'yes'].includes((process.env.MATH_DOCUMENT_GRADING_WORKER_REQUIRED ?? '').toLowerCase());
  let mathDocumentGradingWorker = !workerRequired;
  let workerCapability: MathDocumentGradingWorkerCapabilityStatus | null = null;

  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    db = true;
  } catch {
    console.error('[readyz] database probe failed');
  }

  try {
    const client = redisClient.getClient();
    if (client) {
      redis = (await client.ping()) === 'PONG';
      if (workerRequired && redis && typeof client.get === 'function') {
        const heartbeat = await client.get(MATH_DOCUMENT_GRADING_WORKER_HEARTBEAT_KEY);
        const capability = await client.get(MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_KEY);
        workerCapability = parseMathDocumentGradingWorkerCapability(capability);
        mathDocumentGradingWorker = heartbeat === 'ready' && isMathDocumentGradingWorkerCapabilityReady(workerCapability);
      }
    }
  } catch (error) {
    console.error('[readyz] redis probe failed', error);
    redis = false;
    mathDocumentGradingWorker = false;
  }

  const payload = {
    app: true,
    db,
    redis,
    mathDocumentGradingWorker: {
      required: workerRequired,
      ready: mathDocumentGradingWorker,
      configReady: workerRequired ? workerCapability?.configReady === true : true,
      capabilities: workerCapability?.capabilities ?? null,
      missing: workerRequired ? (workerCapability?.missing ?? ['worker-heartbeat-or-capability']) : [],
    },
    timestamp,
    version: process.env.npm_package_version ?? 'unknown',
  };

  return NextResponse.json(payload, {
    status: db && redis && mathDocumentGradingWorker ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
