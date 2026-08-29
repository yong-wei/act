import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { canAccessClassroomSession } from '@/features/classroom/session';
import { resolveTrustedControlWorkbenchContext } from '@/lib/data-governance/control-workbench-run-context';
import {
  persistControlWorkbenchSimulationRun,
  persistSceneTraceSimulationRun,
  type SimulationRunLaunchContext,
} from '@/lib/data-governance/simulation-scene-run-persistence';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { ControlEngineFailure, controlEngineHttpStatus } from '@/lib/control-engine';
import { computeControlAnalysisServer } from '@/lib/control-engine/server';
import { prisma } from '@/lib/prisma';
import type { ControlAnalysisRequest } from '@/resources/control-system/analysis/types';
import {
  evaluatePIDParams,
  LEGACY_SCENE_TRACE_TARGET,
} from '@/resources/simulations/lib/monte-carlo-optimizer';
import {
  validateCruiseTelemetryBridgeSummary,
  type CruiseTelemetryBridgeSummary,
} from '@/resources/simulations/simulations/cruise/telemetry-bridge';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_REQUEST_BYTES = 300_000;
const CRUISE_PID_LIMITS = {
  kp: [0, 10],
  ki: [0, 5],
  kd: [0, 10],
} as const;
const SAFE_CONTEXT_KEYS = [
  'lessonId',
  'moduleId',
  'stepId',
] as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown, maxLength = 200): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

function launchContext(value: unknown): SimulationRunLaunchContext {
  const source = record(value);
  return Object.fromEntries(
    SAFE_CONTEXT_KEYS.flatMap((key) => {
      const normalized = text(source[key]);
      return normalized ? [[key, normalized]] : [];
    }),
  );
}

async function trustedSceneLaunchContext(
  value: unknown,
  user: {
    id: string;
    role?: unknown;
    profile?: { classId?: string | null } | null;
  },
): Promise<SimulationRunLaunchContext> {
  const untrusted = record(value);
  const sessionId = text(untrusted.sessionId);
  if (!sessionId) return launchContext(value);
  const [classSession, profile] = await Promise.all([
    prisma.classSession.findUnique({
      where: { id: sessionId },
      select: { id: true, classId: true, teacherId: true },
    }),
    user.profile
      ? Promise.resolve(user.profile)
      : prisma.studentProfile.findUnique({
        where: { userId: user.id },
        select: { classId: true },
      }),
  ]);
  if (!canAccessClassroomSession(classSession, { ...user, profile })) {
    return launchContext(value);
  }
  return {
    ...launchContext(value),
    sessionId: classSession?.id,
    classId: classSession?.classId ?? undefined,
  };
}

function isControlAnalysisRequest(value: unknown): value is ControlAnalysisRequest {
  const request = record(value);
  return request.runtimeMode === 'analysis'
    && Object.keys(record(request.plant)).length > 0
    && Array.isArray(request.structures)
    && request.structures.length <= 16
    && Array.isArray(request.outputs)
    && request.outputs.length <= 16
    && Object.keys(record(request.timeRange)).length > 0
    && Object.keys(record(request.frequencyRange)).length > 0
    && Object.keys(record(request.rootLocus)).length > 0;
}

function isCruiseTraceSummary(value: unknown): value is CruiseTelemetryBridgeSummary {
  const summary = record(value);
  const trace = record(summary.trace);
  const envelope = record(trace.envelope);
  const samples = record(trace.samples);
  const traceSummary = record(trace.summary);
  const metrics = record(traceSummary.metrics);
  const completedAt = new Date(String(envelope.completedAt ?? ''));
  const startedAt = new Date(String(envelope.startedAt ?? ''));
  return envelope.sceneId === 'sim/cruise'
    && text(envelope.runId) !== null
    && text(envelope.checksum) !== null
    && Number.isFinite(Number(envelope.seed))
    && Number.isInteger(Number(envelope.seed))
    && !Number.isNaN(startedAt.getTime())
    && !Number.isNaN(completedAt.getTime())
    && startedAt <= completedAt
    && completedAt.getTime() <= Date.now() + 5 * 60_000
    && Number.isFinite(Number(envelope.sampleCadence))
    && Number(envelope.sampleCadence) >= 0
    && Number.isInteger(samples.frameCount)
    && Number(samples.frameCount) >= 0
    && Object.keys(record(traceSummary.metrics)).length > 0
    && Number.isFinite(Number(metrics.controller_kp))
    && Number(metrics.controller_kp) >= CRUISE_PID_LIMITS.kp[0]
    && Number(metrics.controller_kp) <= CRUISE_PID_LIMITS.kp[1]
    && Number.isFinite(Number(metrics.controller_ki))
    && Number(metrics.controller_ki) >= CRUISE_PID_LIMITS.ki[0]
    && Number(metrics.controller_ki) <= CRUISE_PID_LIMITS.ki[1]
    && Number.isFinite(Number(metrics.controller_kd))
    && Number(metrics.controller_kd) >= CRUISE_PID_LIMITS.kd[0]
    && Number(metrics.controller_kd) <= CRUISE_PID_LIMITS.kd[1]
    && typeof traceSummary.passed === 'boolean'
    && validateCruiseTelemetryBridgeSummary(value as CruiseTelemetryBridgeSummary);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Student role required' }, { status: 403 });
    }
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    let body: Record<string, unknown>;
    try {
      body = record(JSON.parse(rawBody));
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    const kind = text(body.kind);
    if (kind === 'control-workbench') {
      const clientRunId = text(body.clientRunId);
      const capabilityId = text(body.capabilityId);
      const untrustedLaunchContext = record(body.launchContext);
      const sessionId = text(untrustedLaunchContext.sessionId);
      const lessonId = text(untrustedLaunchContext.lessonId);
      const stepId = text(untrustedLaunchContext.stepId);
      const moduleId = text(untrustedLaunchContext.moduleId);
      if (
        !clientRunId
        || !capabilityId
        || !sessionId
        || !lessonId
        || !stepId
        || !moduleId
        || !isControlAnalysisRequest(body.request)
      ) {
        return NextResponse.json({ error: 'Invalid control workbench run' }, { status: 400 });
      }
      const trustedContext = await resolveTrustedControlWorkbenchContext({
        user: session.user,
        sessionId,
        lessonId,
        stepId,
        moduleId,
        capabilityId,
      });
      if (!trustedContext) {
        return NextResponse.json({ error: 'Untrusted control workbench context' }, { status: 403 });
      }
      const result = await persistControlWorkbenchSimulationRun(
        prisma,
        session.user.id,
        {
          clientRunId,
          capabilityId,
          request: body.request,
          launchContext: trustedContext,
        },
        computeControlAnalysisServer,
      );
      return NextResponse.json(result);
    }
    if (kind === 'scene-trace') {
      if (!isCruiseTraceSummary(body.traceSummary)) {
        return NextResponse.json({ error: 'Invalid scene trace' }, { status: 400 });
      }
      const result = await persistSceneTraceSimulationRun(
        prisma,
        session.user.id,
        {
          traceSummary: body.traceSummary,
          launchContext: {
            ...await trustedSceneLaunchContext(body.launchContext, session.user),
            registryId: 'sim-scene-cruise',
          },
        },
        (controller) => evaluatePIDParams(controller, { shipSpeed: 15 }, LEGACY_SCENE_TRACE_TARGET),
      );
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: 'Unsupported run kind' }, { status: 400 });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (error instanceof ControlEngineFailure) {
      return NextResponse.json(
        { error: error.message, state: error.state },
        { status: controlEngineHttpStatus(error) },
      );
    }
    console.error('[Simulation Runs API] Failed to persist run:', error);
    return NextResponse.json({ error: 'Failed to persist simulation run' }, { status: 500 });
  }
}
