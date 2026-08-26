import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { CensusCore, CensusObservation, MeasurementReceipt } from '@/lib/architecture-census/types';
import { INVENTORY_KINDS } from '@/lib/architecture-census/types';
import {
  generateArchitectureCharter,
  projectCharterDocuments,
  qualifyArchitectureCharter,
  REQUIRED_BASELINE,
} from '@/lib/architecture-charter';

function observation(partial: Partial<CensusObservation> & Pick<CensusObservation, 'id' | 'kind' | 'identity'>): CensusObservation {
  return {
    surfaceClass: 'production',
    ownership: {
      currentOwnerEvidence: ['feature:teacher'],
      candidateTargetOwner: 'teacher',
      state: 'candidate-target',
      conflictingEvidence: [],
    },
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
      nodeVersion: 'v22.0.0',
      npmVersion: '11.0.0',
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

describe('architecture charter', () => {
  it('assigns exactly one owner and regenerates byte-identical projections', () => {
    const snapshot = core([
      observation({ id: 'api:src/app/api/health/route.ts', kind: 'api', identity: 'src/app/api/health/route.ts' }),
      observation({
        id: 'api:src/app/api/teacher/classes/x/diagnosis-reports/route.ts',
        kind: 'api',
        identity: 'src/app/api/teacher/classes/x/diagnosis-reports/route.ts',
      }),
      observation({
        id: 'gate:package.json:scripts.typecheck',
        kind: 'gate',
        identity: 'package.json:scripts.typecheck',
        attributes: { validator: 'package.json:scripts.typecheck', protectedBoundary: 'local-quality' },
      }),
      observation({
        id: 'compatibility-surface:src/features/teacher/legacy-facade.ts',
        kind: 'compatibility-surface',
        identity: 'src/features/teacher/legacy-facade.ts',
        compatibility: true,
      }),
    ]);
    const first = generateArchitectureCharter(snapshot, []);
    qualifyArchitectureCharter(first.charter, first.failures);
    expect(new Set(first.charter.owners.map((item) => item.owner)).size).toBeGreaterThan(0);
    expect(first.charter.owners.every((item) => Boolean(item.owner))).toBe(true);
    expect(first.charter.blocking).toHaveLength(0);
    const second = generateArchitectureCharter(snapshot, []);
    expect(JSON.stringify(first.charter)).toBe(JSON.stringify(second.charter));
    expect(projectCharterDocuments(first.charter)['refactor-charter.md']).toBe(
      projectCharterDocuments(second.charter)['refactor-charter.md'],
    );
    expect(first.charter.compatibility.some((item) => item.followUpChange === 'enforce-modular-domain-dependency-contracts')).toBe(true);
  });

  it('fails qualification when baseline identity drifts or an item has two owners', () => {
    const drifted = core([]);
    const driftedCore: CensusCore = {
      ...drifted,
      captureIdentity: { ...drifted.captureIdentity, sourceCommit: '0'.repeat(40) },
    };
    expect(generateArchitectureCharter(driftedCore, []).failures).toContain('baseline-commit-drift');

    const conflicted = core([
      observation({
        id: 'api:conflict',
        kind: 'api',
        identity: 'src/features/teacher/conflict.ts',
        ownership: {
          currentOwnerEvidence: ['feature:teacher', 'feature:knowledge'],
          candidateTargetOwner: null,
          state: 'ambiguous',
          conflictingEvidence: ['feature:teacher', 'feature:knowledge'],
        },
      }),
    ]);
    const generated = generateArchitectureCharter(conflicted, []);
    expect(generated.failures.some((item) => item.startsWith('blocking-ownership'))).toBe(true);
    expect(generated.charter.blocking).toHaveLength(1);
    expect(() => qualifyArchitectureCharter(generated.charter, generated.failures)).toThrow(/blocking-ownership/);
  });

  it('qualifies the captured baseline without rewriting product files', () => {
    const censusPath = join(process.cwd(), 'docs/architecture/modular-monolith/baseline/census-core.json');
    const receiptPath = join(process.cwd(), 'docs/architecture/modular-monolith/baseline/receipts.json');
    const snapshot = JSON.parse(readFileSync(censusPath, 'utf8')) as CensusCore;
    const receipts = JSON.parse(readFileSync(receiptPath, 'utf8')) as MeasurementReceipt[];
    const { charter, failures } = generateArchitectureCharter(snapshot, receipts);
    qualifyArchitectureCharter(charter, failures);
    expect(charter.owners.length).toBeGreaterThan(0);
    expect(charter.gates.length).toBeGreaterThan(0);
    expect(charter.compatibility.length).toBeGreaterThan(0);
    expect(charter.blocking).toHaveLength(0);
    expect(charter.compatibility.some((item) => item.followUpChange === 'decouple-teacher-diagnosis-route-contract')).toBe(true);
    const docs = projectCharterDocuments(charter);
    expect(Object.keys(docs).sort()).toEqual([
      'bounded-context-map.md',
      'dependency-rules.md',
      'deprecation-ledger.md',
      'refactor-charter.md',
      'trust-boundary-matrix.md',
    ].sort());
    expect(docs['refactor-charter.md']).toContain(REQUIRED_BASELINE.sourceCommit);
    expect(docs['refactor-charter.md']).not.toContain('/Users/');
  });
});
