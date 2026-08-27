import { serializeDeterministic, sha256Text } from '@/lib/architecture-census/serialize';

import { assertPortable } from './privacy';
import {
  LEDGER_SCHEMA_VERSION,
  QUALIFICATIONS,
  type AttributedRow,
  type ObservationStatus,
  type ObservationWindow,
  type Qualification,
  type SourceLedger,
  type SourceType,
} from './types';

function emptyTotals(): Record<Qualification, { bytes: number; count: number }> {
  return {
    observed: { bytes: 0, count: 0 },
    excluded: { bytes: 0, count: 0 },
    duplicate: { bytes: 0, count: 0 },
    delayed: { bytes: 0, count: 0 },
    unattributed: { bytes: 0, count: 0 },
  };
}

export function balanceLedger(input: {
  readonly sourceType: SourceType;
  readonly window: ObservationWindow;
  readonly exporterVersion: string;
  readonly inputHash: string;
  readonly reportingDelayHours: number | null;
  readonly rows: readonly AttributedRow[];
  readonly declaredDenominatorBytes: number;
  readonly declaredDenominatorCount: number;
  readonly missingReason?: string | null;
  readonly conflicts?: readonly string[];
}): SourceLedger {
  const totals = emptyTotals();
  for (const row of [...input.rows].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId))) {
    totals[row.qualification].bytes += row.bytes;
    totals[row.qualification].count += row.count;
  }
  const classifiedBytes = QUALIFICATIONS.reduce((sum, key) => sum + totals[key].bytes, 0);
  const classifiedCount = QUALIFICATIONS.reduce((sum, key) => sum + totals[key].count, 0);
  const denominatorBytes = input.declaredDenominatorBytes;
  const denominatorCount = input.declaredDenominatorCount;
  const balanced = classifiedBytes === denominatorBytes && classifiedCount === denominatorCount;
  const conflicts = [...(input.conflicts ?? [])].sort();
  let status: ObservationStatus = 'qualified';
  if (input.missingReason || totals.delayed.bytes > 0 || totals.delayed.count > 0) status = 'incomplete';
  else if (!balanced || conflicts.length > 0) status = 'blocked';
  const body = {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    sourceType: input.sourceType,
    window: input.window,
    exporterVersion: input.exporterVersion,
    inputHash: input.inputHash,
    reportingDelayHours: input.reportingDelayHours,
    status,
    rows: [...input.rows].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId)),
    totals,
    denominatorBytes,
    denominatorCount,
    missingReason: input.missingReason ?? null,
    conflicts,
  };
  const serialized = serializeDeterministic(body);
  assertPortable(serialized, 'source-ledger');
  return { ...body, denominatorHash: sha256Text(serialized) };
}

export function missingLedger(sourceType: SourceType, window: ObservationWindow, reason: string): SourceLedger {
  return balanceLedger({
    sourceType,
    window,
    exporterVersion: 'unavailable',
    inputHash: sha256Text(`${sourceType}:${reason}`),
    reportingDelayHours: null,
    rows: [],
    declaredDenominatorBytes: 0,
    declaredDenominatorCount: 0,
    missingReason: reason,
  });
}
