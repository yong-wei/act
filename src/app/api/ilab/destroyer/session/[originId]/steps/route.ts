import { NextResponse } from 'next/server';

import { submitDestroyerStep, toIlabHttpError } from '@/features/ilab/destroyer-session';
import { readDestroyerSamples, type DestroyerReadings } from '@/resources/simulations/simulations/destroyer-experiment';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, props: { params: Promise<{ originId: string }> }) {
  try {
    const { originId } = await props.params;
    const body = await request.json() as {
      seq?: unknown;
      readings?: unknown;
      samples?: unknown;
      startedAtMs?: unknown;
    };
    const readings: DestroyerReadings = {};
    if (body.readings && typeof body.readings === 'object' && !Array.isArray(body.readings)) {
      for (const [key, value] of Object.entries(body.readings)) {
        if (typeof value === 'string') readings[key] = value;
      }
    }
    const session = await submitDestroyerStep(originId, {
      seq: typeof body.seq === 'number' ? body.seq : 0,
      readings,
      samples: readDestroyerSamples(body.samples),
      startedAtMs: typeof body.startedAtMs === 'number' ? body.startedAtMs : Date.now(),
    });
    return NextResponse.json(session);
  } catch (error) {
    const httpError = toIlabHttpError(error);
    return NextResponse.json(
      { error: httpError.message, ...(httpError.retryReport ? { retryReport: true } : {}) },
      { status: httpError.status },
    );
  }
}
