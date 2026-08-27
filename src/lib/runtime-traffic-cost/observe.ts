import { serializeDeterministic, sha256Text } from '@/lib/architecture-census/serialize';

import { missingLedger } from './ledger';
import { normalizeSourceExport } from './normalize';
import { assertPortable } from './privacy';
import { expectedRouteClasses, expectedSources } from './taxonomy';
import {
  OBSERVATION_SCHEMA_VERSION,
  TOOL_VERSION,
  type ObservationEnvelope,
  type ObservationStatus,
  type ObservationWindow,
  type SourceLedger,
  type SourceType,
} from './types';

export interface ObserveInput {
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly dirty: boolean;
  readonly mixedWorktree: boolean;
  readonly environment: string;
  readonly window: ObservationWindow;
  readonly capturedAt: string;
  readonly exports: readonly unknown[];
}

function windowsCompatible(left: ObservationWindow, right: ObservationWindow): boolean {
  return left.start === right.start && left.end === right.end && left.timezone === right.timezone;
}

export function observeTraffic(input: ObserveInput): ObservationEnvelope {
  const byType = new Map<SourceType, SourceLedger>();
  const conflicts: string[] = [];
  for (const raw of input.exports) {
    const ledger = normalizeSourceExport(raw);
    const existing = byType.get(ledger.sourceType);
    if (existing) {
      conflicts.push(`duplicate-source:${ledger.sourceType}`);
      continue;
    }
    byType.set(ledger.sourceType, ledger);
    conflicts.push(...ledger.conflicts);
  }

  const missingSources = expectedSources()
    .filter((sourceType) => !byType.has(sourceType))
    .map((sourceType) => ({ sourceType, reason: 'source-export-unavailable' }));
  for (const missing of missingSources) {
    byType.set(missing.sourceType, missingLedger(missing.sourceType, input.window, missing.reason));
  }

  const ledgers = expectedSources().map((sourceType) => byType.get(sourceType)!);
  const mixedWindow = ledgers.some((ledger) => !ledger.missingReason && !windowsCompatible(ledger.window, input.window));
  if (mixedWindow) conflicts.push('mixed-window');

  let status: ObservationStatus = 'qualified';
  if (
    input.dirty
    || input.mixedWorktree
    || ledgers.some((ledger) => ledger.status === 'blocked')
    || conflicts.some((item) => item.startsWith('duplicate-source:'))
  ) {
    status = 'blocked';
  } else if (missingSources.length > 0 || mixedWindow || ledgers.some((ledger) => ledger.status === 'incomplete')) {
    status = 'incomplete';
  }

  const body = {
    schemaVersion: OBSERVATION_SCHEMA_VERSION,
    sourceCommit: input.sourceCommit,
    sourceTree: input.sourceTree,
    dirty: input.dirty,
    mixedWorktree: input.mixedWorktree,
    environment: input.environment,
    window: input.window,
    timezone: input.window.timezone,
    toolVersion: TOOL_VERSION,
    capturedAt: input.capturedAt,
    status,
    routeTaxonomy: expectedRouteClasses(),
    expectedSources: expectedSources(),
    ledgers,
    missingSources,
    conflicts: [...new Set(conflicts)].sort(),
  };
  const serialized = serializeDeterministic(body);
  assertPortable(serialized, 'observation');
  return { ...body, observationId: sha256Text(serialized) } as ObservationEnvelope;
}

export function summarizeObservation(observation: ObservationEnvelope): string {
  const lines = [
    `# Runtime traffic observation`,
    ``,
    `- status: ${observation.status}`,
    `- commit: ${observation.sourceCommit}`,
    `- tree: ${observation.sourceTree}`,
    `- window: ${observation.window.start} .. ${observation.window.end} (${observation.window.timezone})`,
    `- dirty: ${observation.dirty}`,
    ``,
    `Vendor ledgers are independent and are not summed.`,
    ``,
  ];
  for (const ledger of observation.ledgers) {
    lines.push(`## ${ledger.sourceType}`);
    lines.push(`- status: ${ledger.status}`);
    lines.push(`- denominator bytes: ${ledger.denominatorBytes}`);
    lines.push(`- observed bytes: ${ledger.totals.observed.bytes}`);
    lines.push(`- unattributed bytes: ${ledger.totals.unattributed.bytes}`);
    lines.push(`- delayed bytes: ${ledger.totals.delayed.bytes}`);
    if (ledger.missingReason) lines.push(`- missing: ${ledger.missingReason}`);
    if (ledger.reportingDelayHours !== null) lines.push(`- reporting delay hours: ${ledger.reportingDelayHours}`);
    lines.push('');
  }
  const text = `${lines.join('\n')}\n`;
  assertPortable(text, 'observation-summary');
  return text;
}

