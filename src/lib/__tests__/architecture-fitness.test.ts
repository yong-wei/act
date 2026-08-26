import { describe, expect, it } from 'vitest';

import type { CensusCore, CensusObservation } from '@/lib/architecture-census/types';
import { INVENTORY_KINDS } from '@/lib/architecture-census/types';
import { REQUIRED_BASELINE } from '@/lib/architecture-charter';
import { assertFitness, checkFitness, createAllowlist } from '@/lib/architecture-fitness';

function observation(partial: Partial<CensusObservation> & Pick<CensusObservation, 'id' | 'kind' | 'identity'>): CensusObservation {
  return {
    surfaceClass: 'production',
    ownership: { currentOwnerEvidence: [], candidateTargetOwner: null, state: 'resolved-current', conflictingEvidence: [] },
    evidence: [partial.identity],
    trustClass: null,
    compatibility: false,
    notes: [],
    attributes: {},
    ...partial,
  };
}

function core(observations: CensusObservation[]): CensusCore {
  return {
    schemaVersion: REQUIRED_BASELINE.schemaVersion,
    captureIdentity: {
      sourceCommit: REQUIRED_BASELINE.sourceCommit,
      sourceTree: REQUIRED_BASELINE.sourceTree,
      commitTime: '2026-08-26T00:00:00Z',
      nodeVersion: 'v22',
      npmVersion: '11',
      typescriptVersion: '5.8.3',
    },
    manifests: INVENTORY_KINDS.map((kind) => ({
      kind,
      includeRules: [],
      excludeRules: [],
      totals: { discovered: 0, represented: 0, excluded: 0, duplicate: 0, unresolved: 0 },
    })),
    observations,
    commandSummaries: [],
  };
}

describe('architecture fitness', () => {
  it('allowlists existing production feature-to-app debt and fails a new edge', () => {
    const baseline = core([
      observation({
        id: 'dependency-edge:src/features/teacher/teacher-diagnosis-report-history.tsx->src/app/api/teacher/classes/[classId]/diagnosis-reports/route.ts',
        kind: 'dependency-edge',
        identity: 'src/features/teacher/teacher-diagnosis-report-history.tsx->src/app/api/teacher/classes/[classId]/diagnosis-reports/route.ts',
        attributes: {
          from: 'src/features/teacher/teacher-diagnosis-report-history.tsx',
          to: 'src/app/api/teacher/classes/[classId]/diagnosis-reports/route.ts',
          context: 'production',
          featureToApp: true,
          deepImport: false,
          crossDomain: false,
        },
      }),
      observation({
        id: 'dependency-edge:src/features/teacher/__tests__/history.test.ts->src/app/api/teacher/classes/[classId]/diagnosis-reports/route.ts',
        kind: 'dependency-edge',
        identity: 'src/features/teacher/__tests__/history.test.ts->src/app/api/teacher/classes/[classId]/diagnosis-reports/route.ts',
        surfaceClass: 'test',
        attributes: {
          from: 'src/features/teacher/__tests__/history.test.ts',
          to: 'src/app/api/teacher/classes/[classId]/diagnosis-reports/route.ts',
          context: 'test',
          featureToApp: true,
          deepImport: false,
          crossDomain: false,
        },
      }),
    ]);
    const allowlist = createAllowlist(baseline, 'charterhash');
    expect(allowlist.entries.some((item) => item.kind === 'feature-to-app' && item.followUpChange === 'decouple-teacher-diagnosis-route-contract')).toBe(true);
    expect(allowlist.entries.some((item) => item.identity.includes('__tests__'))).toBe(false);
    const report = checkFitness(baseline, allowlist);
    expect(report.ok).toBe(true);
    assertFitness(report);

    const mutated = core([
      ...baseline.observations,
      observation({
        id: 'dependency-edge:src/features/teacher/new.ts->src/app/api/health/route.ts',
        kind: 'dependency-edge',
        identity: 'src/features/teacher/new.ts->src/app/api/health/route.ts',
        attributes: {
          from: 'src/features/teacher/new.ts',
          to: 'src/app/api/health/route.ts',
          context: 'production',
          featureToApp: true,
          deepImport: false,
          crossDomain: false,
        },
      }),
    ]);
    const failed = checkFitness(mutated, allowlist);
    expect(failed.ok).toBe(false);
    expect(() => assertFitness(failed)).toThrow(/new-architecture-violation/);
  });

  it('does not treat public-api imports as deep-import violations', () => {
    const snapshot = core([
      observation({
        id: 'deep-import:src/features/teacher/view.ts->src/features/knowledge/public-api.ts',
        kind: 'deep-import',
        identity: 'src/features/teacher/view.ts->src/features/knowledge/public-api.ts',
        attributes: {
          from: 'src/features/teacher/view.ts',
          to: 'src/features/knowledge/public-api.ts',
        },
      }),
    ]);
    expect(createAllowlist(snapshot, 'charterhash').entries.some((item) => item.kind === 'deep-import')).toBe(false);
  });

  it('records domain-core Next imports and ignores React UI files', () => {
    const snapshot = core([]);
    const files = [
      { path: 'src/features/teacher/application/read.ts', content: 'import { headers } from "next/headers";\n', byteLength: 10 },
      { path: 'src/features/teacher/panel.tsx', content: 'import { useState } from "react";\n', byteLength: 10 },
    ];
    const entries = createAllowlist(snapshot, 'charterhash', files).entries;
    expect(entries.some((item) => item.identity.endsWith('application/read.ts'))).toBe(true);
    expect(entries.some((item) => item.identity.endsWith('panel.tsx'))).toBe(false);
  });

  it('treats a new src/lib business file as a freeze violation', () => {
    const baseline = core([
      observation({ id: 'script:src/lib/existing.ts', kind: 'script', identity: 'src/lib/existing.ts' }),
    ]);
    const allowlist = createAllowlist(baseline, 'charterhash');
    const mutated = core([
      observation({ id: 'script:src/lib/existing.ts', kind: 'script', identity: 'src/lib/existing.ts' }),
      observation({ id: 'script:src/lib/new-business.ts', kind: 'script', identity: 'src/lib/new-business.ts' }),
    ]);
    expect(checkFitness(mutated, allowlist).newViolations.some((item) => item.identity.endsWith('new-business.ts'))).toBe(true);
  });
});
