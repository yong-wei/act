import { NextResponse } from 'next/server';

import { submitVesselStep, toIlabHttpError } from '@/features/ilab/vessel-session';
import { readVesselSamples, type VesselReadings } from '@/resources/simulations/simulations/vessel-experiment';

export const dynamic = 'force-dynamic';

export async function POST(request: Request, props: { params: Promise<{ originId: string }> }) {
  try {
    const { originId } = await props.params;
    const body = await request.json() as {
      experimentKey?: unknown;
      seq?: unknown;
      readings?: unknown;
      samples?: unknown;
      startedAtMs?: unknown;
      sketchImage?: unknown;
    };
    const readings: VesselReadings = {};
    if (body.readings && typeof body.readings === 'object' && !Array.isArray(body.readings)) {
      for (const [key, value] of Object.entries(body.readings)) {
        if (typeof value === 'string') readings[key] = value;
      }
    }
    const session = await submitVesselStep(originId, {
      experimentKey: typeof body.experimentKey === 'string' ? body.experimentKey : '',
      seq: typeof body.seq === 'number' ? body.seq : 0,
      readings,
      samples: readVesselSamples(body.samples),
      startedAtMs: typeof body.startedAtMs === 'number' ? body.startedAtMs : Date.now(),
      sketchImage: typeof body.sketchImage === 'string' ? body.sketchImage : undefined,
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
