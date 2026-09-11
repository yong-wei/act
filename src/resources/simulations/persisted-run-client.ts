'use client';

import {
  buildAdaptivePathCompletionRequest,
  resolveAdaptivePathLaunchReturnContext,
} from '@/features/personalization/experience/adaptive-learning-center-contracts';
import { publishAdaptivePathJourneyResponse } from '@/features/personalization/experience/adaptive-path-journey-control';
import type { ControlAnalysisRequest } from '@/resources/control-system/analysis/types';
import type { CruiseTelemetryBridgeSummary } from './simulations/cruise/telemetry-bridge';

interface PersistedRunResponse {
  simulationRunId: string;
}

export function resolveClassroomSessionIdFromPathname(pathname: string): string | undefined {
  const match = pathname.match(/\/student\/([^/?#]+)/);
  const sessionId = match?.[1] ? decodeURIComponent(match[1]).trim() : '';
  return sessionId && sessionId !== 'demo' ? sessionId : undefined;
}

async function persistRun(payload: Record<string, unknown>): Promise<PersistedRunResponse> {
  const response = await fetch('/api/simulation/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('仿真结果保存失败，请重试。');
  }
  const result = await response.json() as Partial<PersistedRunResponse>;
  if (!result.simulationRunId) {
    throw new Error('仿真结果未返回有效记录。');
  }
  await completeAdaptivePathAfterPersistedRun({
    simulationRunId: result.simulationRunId,
    resourceType: payload.kind === 'control-workbench' ? 'control_workbench' : 'simulation',
  });
  return { simulationRunId: result.simulationRunId };
}

export async function completeAdaptivePathAfterPersistedRun(input: {
  simulationRunId: string;
  resourceType: 'simulation' | 'control_workbench';
}): Promise<void> {
  if (typeof window === 'undefined') return;
  const launchContext = resolveAdaptivePathLaunchReturnContext(new URLSearchParams(window.location.search));
  if (!launchContext || launchContext.resourceType !== input.resourceType) return;
  const request = buildAdaptivePathCompletionRequest({
    launchContext,
    completedAt: new Date().toISOString(),
    simulationRef: { id: input.simulationRunId },
  });
  if (!request) return;
  try {
    const response = await fetch(request.href, {
      method: request.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body),
    });
    if (!response.ok) return;
    publishAdaptivePathJourneyResponse(await response.json().catch(() => null));
  } catch {
    // Persist already succeeded; path write-back must not fail the run.
  }
}

export function persistPathLaunchedControlWorkbenchRun(input: {
  pathId: string;
  nodeId: string;
  request: ControlAnalysisRequest;
}) {
  return persistControlWorkbenchRun({
    clientRunId: `path-workbench:${input.pathId}:${input.nodeId}`,
    capabilityId: input.nodeId,
    request: input.request,
    launchContext: {
      pathId: input.pathId,
      nodeId: input.nodeId,
      resourceId: input.nodeId,
    },
  });
}

export function persistControlWorkbenchRun(input: {
  clientRunId: string;
  capabilityId: string;
  request: ControlAnalysisRequest;
  launchContext: Record<string, string | undefined>;
}) {
  const sessionId = typeof window === 'undefined'
    ? undefined
    : resolveClassroomSessionIdFromPathname(window.location.pathname);
  return persistRun({
    kind: 'control-workbench',
    ...input,
    launchContext: {
      ...input.launchContext,
      sessionId: input.launchContext.sessionId ?? sessionId,
    },
  });
}

export function persistSceneTraceRun(input: {
  traceSummary: CruiseTelemetryBridgeSummary;
  launchContext: Record<string, string | undefined>;
}) {
  return persistRun({
    kind: 'scene-trace',
    ...input,
  });
}

export function shouldPersistPathLaunchedCourseDemo(input: {
  launchContext: ReturnType<typeof resolveAdaptivePathLaunchReturnContext>;
  currentStepId: string;
  targetStepId: string | null;
}) {
  return input.launchContext?.resourceType === 'simulation'
    && Boolean(input.targetStepId)
    && input.currentStepId === input.targetStepId;
}

export function persistPathLaunchedCourseDemoIfCurrentStep(stepId: string) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const launchContext = resolveAdaptivePathLaunchReturnContext(params);
  if (!launchContext || !shouldPersistPathLaunchedCourseDemo({
    launchContext,
    currentStepId: stepId,
    targetStepId: params.get('step'),
  })) {
    return;
  }
  const clientEventId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `path-course-demo:${Date.now()}`;
  return persistPathLaunchedCourseDemoRun({
    pathId: launchContext.pathId,
    nodeId: launchContext.nodeId,
    stepId,
    clientEventId,
  }).catch(() => undefined);
}

export async function persistPathLaunchedCourseDemoRun(input: {
  pathId: string;
  nodeId: string;
  stepId: string;
  clientEventId: string;
}) {
  const eventResponse = await fetch('/api/interactive/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      events: [{
        id: input.clientEventId,
        type: 'submit',
        timestamp: Date.now(),
        resourceKey: input.nodeId,
        stepId: input.stepId,
        data: {
          clientEventId: input.clientEventId,
          pathId: input.pathId,
          nodeId: input.nodeId,
          stepId: input.stepId,
          resourceType: 'simulation',
        },
      }],
    }),
  });
  let persistedCount = 0;
  try {
    const payload = await eventResponse.json() as { count?: unknown };
    persistedCount = typeof payload.count === 'number' ? payload.count : 0;
  } catch {
    persistedCount = 0;
  }
  if (!eventResponse.ok || persistedCount < 1) {
    throw new Error('路径实验提交未持久化，无法完成节点。');
  }
  return persistRun({
    kind: 'path-course-demo',
    clientEventId: input.clientEventId,
    launchContext: {
      pathId: input.pathId,
      nodeId: input.nodeId,
      stepId: input.stepId,
    },
  });
}
