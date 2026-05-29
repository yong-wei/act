import { createHash } from 'node:crypto';

import type {
  SimulationReplayMetadata,
  SimulationRunContext,
} from '../core/seeded-rng';

function normalizeReplayValue(value: unknown): unknown {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    const rounded = Number(value.toFixed(6));
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeReplayValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== 'checksum' && key !== 'runId' && key !== 'createdAt' && key !== 'startedAt' && key !== 'completedAt')
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeReplayValue(entry)]),
    );
  }

  return value;
}

export function stableReplayStringify(value: unknown): string {
  return JSON.stringify(normalizeReplayValue(value));
}

export function computeReplayChecksum(payload: unknown): string {
  const digest = createHash('sha256')
    .update(stableReplayStringify(payload))
    .digest('hex');
  return `sha256:${digest}`;
}

export function buildSimulationReplayMetadata(
  context: SimulationRunContext,
  payload: unknown,
): SimulationReplayMetadata {
  return {
    ...context,
    checksum: computeReplayChecksum({
      context,
      payload,
    }),
  };
}
