'use client';

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
  return { simulationRunId: result.simulationRunId };
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
