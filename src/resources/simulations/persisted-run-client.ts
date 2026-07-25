'use client';

import type { ControlAnalysisRequest } from '@/resources/control-system/analysis/types';
import type { CruiseTelemetryBridgeSummary } from './simulations/cruise/telemetry-bridge';

interface PersistedRunResponse {
  simulationRunId: string;
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
  return persistRun({
    kind: 'control-workbench',
    ...input,
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
