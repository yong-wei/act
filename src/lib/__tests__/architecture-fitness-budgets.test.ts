import { describe, expect, it } from 'vitest';

import { createGraphMeasurementReceipt, graphManifestHash, GRAPH_DEFINITIONS, GRAPH_IDS, type GraphId, type GraphManifest, type GraphMeasurementReceipt } from '../../../scripts/typescript-graphs/contracts';
import type { CensusCore, CensusObservation } from '@/lib/architecture-census/types';
import { INVENTORY_KINDS } from '@/lib/architecture-census/types';
import { REQUIRED_BASELINE } from '@/lib/architecture-charter';
import {
  createFitnessBudgetLedger,
  evaluateFitnessBudgets,
  projectCompileBudgets,
  fitnessBudgetLedgerHash,
  serializeFitnessBudgetReport,
  validateExceptionSet,
  validateFitnessBudgetLedger,
} from '@/lib/architecture-fitness';
import { createAllowlist, checkFitness } from '@/lib/architecture-fitness';

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

function core(observations: readonly CensusObservation[], sourceCommit = REQUIRED_BASELINE.sourceCommit, sourceTree = REQUIRED_BASELINE.sourceTree): CensusCore {
  const counts = new Map<string, number>();
  for (const item of observations) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  return {
    schemaVersion: REQUIRED_BASELINE.schemaVersion,
    captureIdentity: {
      sourceCommit,
      sourceTree,
      commitTime: '2026-08-27T00:00:00Z',
      nodeVersion: 'v26',
      npmVersion: '11',
      typescriptVersion: '5.8.3',
    },
    manifests: INVENTORY_KINDS.map((kind) => {
      const count = counts.get(kind) ?? 0;
      return {
        kind,
        includeRules: [`kind:${kind}`],
        excludeRules: [],
        totals: { discovered: count, represented: count, excluded: 0, duplicate: 0, unresolved: 0 },
      };
    }),
    observations: [...observations],
    commandSummaries: [],
  };
}

function edge(from: string, to: string, attributes: Record<string, string | number | boolean | null> = {}): CensusObservation {
  const identity = `${from}->${to}`;
  return observation({
    id: `dependency-edge:${identity}`,
    kind: 'dependency-edge',
    identity,
    evidence: [from, to],
    attributes: { from, to, context: 'production', crossDomain: false, deepImport: false, featureToApp: false, ...attributes },
  });
}

function reverse(from: string, to: string): CensusObservation {
  const identity = `${to}<-${from}`;
  return observation({
    id: `reverse-edge:${identity}`,
    kind: 'reverse-edge',
    identity,
    evidence: [to, from],
    attributes: { from: to, to: from, context: 'production' },
  });
}

function graphManifest(graph: GraphId, sourceCommit: string, sourceTree: string): GraphManifest {
  const definition = GRAPH_DEFINITIONS.find((item) => item.id === graph)!;
  return {
    schemaVersion: 'act-typescript-graph-manifest/v1',
    contractVersion: 'act-typescript-graph-contract/v1',
    graph,
    kind: definition.kind,
    scope: definition.scope,
    sourceCommit,
    sourceTree,
    configPath: definition.configPath,
    includeRoots: definition.entrypointRoots,
    excludeRoots: definition.requiredExcludeRoots,
    compilerOptions: {},
    projectReferences: [],
    entrypoints: [],
    unclassifiedEntrypoints: [],
    files: [],
    sharedContractOwners: [],
  };
}

function graphReceipt(
  manifest: GraphManifest,
  sourceCommit: string,
  sourceTree: string,
  overrides: Partial<Omit<GraphMeasurementReceipt, 'schemaVersion' | 'receiptId'>> = {},
): GraphMeasurementReceipt {
  const definition = GRAPH_DEFINITIONS.find((item) => item.id === manifest.graph)!;
  return createGraphMeasurementReceipt({
    graph: manifest.graph,
    command: definition.command,
    scope: definition.scope,
    sourceCommit,
    sourceTree,
    dirty: false,
    manifestHash: graphManifestHash(manifest),
    fixturePath: definition.fixturePath,
    fixtureProbe: false,
    toolchain: { node: 'v26', typescript: '5.8.3' },
    platform: 'darwin-arm64',
    cacheMode: 'cold',
    capturedAt: '2026-08-27T00:00:00.000Z',
    durationMs: 100,
    peakRssBytes: 1000,
    fileCount: 10,
    exitStatus: 0,
    status: 'passed',
    tscErrorCount: 0,
    boundaryFailureCount: 0,
    failureCodes: [],
    ...overrides,
  });
}

function receiptWithOverrides(
  receipt: GraphMeasurementReceipt,
  overrides: Partial<Omit<GraphMeasurementReceipt, 'schemaVersion' | 'receiptId'>>,
): GraphMeasurementReceipt {
  const { receiptId: _ignored, schemaVersion: _schemaVersion, ...draft } = receipt;
  return createGraphMeasurementReceipt({ ...draft, ...overrides });
}

describe('architecture fitness budgets', () => {
  it('creates a complete deterministic ledger and qualifies unchanged synthetic input', () => {
    const baseline = core([observation({
      id: 'change-center:src/features/teacher/entry.ts',
      kind: 'change-center',
      identity: 'src/features/teacher/entry.ts',
      attributes: { byteLength: 100, reason: 'framework-entrypoint' },
    })]);
    const allowlist = createAllowlist(baseline, 'charterhash');
    const ledger = createFitnessBudgetLedger({ baselineCore: baseline, allowlist });
    expect(Object.keys(ledger.budgets[0]).sort()).toEqual([
      'baselineIdentity', 'budgetId', 'deletionCondition', 'direction', 'evidenceRefs', 'exceptionState',
      'followUpChange', 'metricKind', 'observedValue', 'owner', 'scope', 'sourceCommit', 'sourceTree', 'status', 'totals',
    ]);
    expect(validateFitnessBudgetLedger(ledger)).toEqual([]);
    const input = { baselineCore: baseline, currentCore: baseline, allowlist, baselineAllowlist: allowlist, ledger, sourceState: {} };
    const first = evaluateFitnessBudgets(input);
    const second = evaluateFitnessBudgets(input);
    expect(first.ok).toBe(true);
    expect(first.status).toBe('qualified');
    expect(serializeFitnessBudgetReport(first)).toBe(serializeFitnessBudgetReport(second));

    const alteredLedger = {
      ...ledger,
      budgets: ledger.budgets.map((record, index) => index === 0
        ? { ...record, deletionCondition: `${record.deletionCondition}:updated` }
        : record),
    };
    const ledgerDrift = evaluateFitnessBudgets({ ...input, ledger: alteredLedger, expectedLedgerHash: fitnessBudgetLedgerHash(ledger) });
    expect(ledgerDrift.failures).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'ledger-hash-drift' })]));
    const ledgerConsistent = evaluateFitnessBudgets({
      ...input,
      ledger: alteredLedger,
      expectedLedgerHash: fitnessBudgetLedgerHash(alteredLedger),
    });
    expect(ledgerConsistent.failures).not.toEqual(expect.arrayContaining([expect.objectContaining({ code: 'ledger-hash-drift' })]));
    expect(ledgerConsistent.failures).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'ledger-rebuild-drift' })]));
  });

  it('fails new feature-to-app, deep-import, and SCC debt while preserving the old contract', () => {
    const oldFrom = 'src/features/teacher/view.ts';
    const oldTo = 'src/app/api/teacher/route.ts';
    const baselineScc = observation({
      id: 'scc:scc:src/features/teacher/a.ts|src/features/teacher/b.ts',
      kind: 'scc',
      identity: 'scc:src/features/teacher/a.ts|src/features/teacher/b.ts',
      evidence: ['src/features/teacher/a.ts', 'src/features/teacher/b.ts'],
      notes: ['src/features/teacher/a.ts->src/features/teacher/b.ts'],
      attributes: { memberCount: 2, edgeCount: 1 },
    });
    const baselineDeep = observation({
      id: 'deep-import:src/features/teacher/view.ts->src/features/assessment/internal.ts',
      kind: 'deep-import',
      identity: 'src/features/teacher/view.ts->src/features/assessment/internal.ts',
      attributes: { from: 'src/features/teacher/view.ts', to: 'src/features/assessment/internal.ts' },
    });
    const cycleEdge = edge('src/features/teacher/a.ts', 'src/features/teacher/b.ts');
    const cycleReverse = reverse('src/features/teacher/a.ts', 'src/features/teacher/b.ts');
    const baseline = core([cycleEdge, cycleReverse, baselineScc, baselineDeep]);
    const allowlist = createAllowlist(baseline, 'charterhash');
    expect(checkFitness(baseline, allowlist).ok).toBe(true);
    const current = core([
      baselineScc,
      baselineDeep,
      edge(oldFrom, oldTo, { featureToApp: true }),
      reverse(oldFrom, oldTo),
      edge('src/features/teacher/new.ts', 'src/features/assessment/internal.ts', { crossDomain: true, deepImport: true }),
      reverse('src/features/teacher/new.ts', 'src/features/assessment/internal.ts'),
      cycleEdge,
      cycleReverse,
      observation({
        id: 'scc:scc:src/features/teacher/a.ts|src/features/teacher/b.ts|src/features/teacher/c.ts',
        kind: 'scc',
        identity: 'scc:src/features/teacher/a.ts|src/features/teacher/b.ts|src/features/teacher/c.ts',
        evidence: ['src/features/teacher/a.ts', 'src/features/teacher/b.ts', 'src/features/teacher/c.ts'],
        notes: ['src/features/teacher/a.ts->src/features/teacher/b.ts'],
        attributes: { memberCount: 3, edgeCount: 1 },
      }),
    ]);
    const ledger = createFitnessBudgetLedger({ baselineCore: baseline, allowlist });
    const report = evaluateFitnessBudgets({ baselineCore: baseline, currentCore: current, allowlist, ledger, sourceState: {} });
    expect(report.ok).toBe(false);
    expect(report.failures.map((item) => item.code)).toEqual(expect.arrayContaining(['new-forbidden-dependency', 'new-scc-member']));
  });

  it('rejects exception additions, edits, owner transfers, and record fields, while allowing shrink', () => {
    const from = 'src/features/teacher/view.ts';
    const to = 'src/app/api/teacher/route.ts';
    const baseline = core([edge(from, to, { featureToApp: true })]);
    const allowlist = createAllowlist(baseline, 'charterhash');
    const entry = allowlist.entries[0];
    expect(entry).toBeDefined();
    expect(validateExceptionSet(allowlist.entries, [])).toEqual([]);
    expect(validateExceptionSet(allowlist.entries, [...allowlist.entries, { ...entry, id: 'new-exception' }])).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'new-exception' })]),
    );
    expect(validateExceptionSet(allowlist.entries, [{ ...entry, owner: 'arena' }])).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'exception-owner-transfer' })]),
    );
    expect(validateExceptionSet(allowlist.entries, [{ ...entry, pattern: 'src/**' } as typeof entry])).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'exception-pattern-widened' })]),
    );
    expect(validateExceptionSet(allowlist.entries, [{ ...entry, deletionCondition: '' }])).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'exception-deletion-condition-removed' })]),
    );
    const ledger = createFitnessBudgetLedger({ baselineCore: baseline, allowlist });
    const malformed = {
      ...ledger,
      budgets: ledger.budgets.map((record, index) => index === 0 ? { ...record, pattern: 'src/**' } : record),
    } as unknown as typeof ledger;
    expect(validateFitnessBudgetLedger(malformed).some((item) => item.code === 'budget-record-extra-field')).toBe(true);
  });

  it('freezes center metrics and redacts local paths in reports', () => {
    const baseline = core([observation({
      id: 'change-center:src/features/teacher/entry.ts',
      kind: 'change-center',
      identity: 'src/features/teacher/entry.ts',
      attributes: { byteLength: 100, reason: 'framework-entrypoint' },
    })]);
    const allowlist = createAllowlist(baseline, 'charterhash');
    const ledger = createFitnessBudgetLedger({ baselineCore: baseline, allowlist });
    const current = core([observation({
      id: 'change-center:src/features/teacher/entry.ts',
      kind: 'change-center',
      identity: 'src/features/teacher/entry.ts',
      attributes: { byteLength: 101, reason: 'framework-entrypoint' },
    })], 'current', 'current-tree');
    const report = evaluateFitnessBudgets({ baselineCore: baseline, currentCore: current, allowlist, ledger, sourceState: {} });
    expect(report.failures).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'frozen-metric-growth' })]));
    const unsafe = { ...report, budgets: report.budgets.map((record) => ({ ...record, evidenceRefs: ['/Users/private/project/file.ts'] })) };
    const serialized = serializeFitnessBudgetReport(unsafe);
    expect(serialized).not.toContain('/Users/private');
    expect(serialized).toBe(serializeFitnessBudgetReport(unsafe));
  });

  it('keeps an allowlisted exception inherited when the current violation disappears', () => {
    const baseline = core([edge('src/features/teacher/view.ts', 'src/app/api/teacher/route.ts', { featureToApp: true })]);
    const allowlist = createAllowlist(baseline, 'charterhash');
    const ledger = createFitnessBudgetLedger({ baselineCore: baseline, allowlist });
    const current = core([]);

    const inherited = evaluateFitnessBudgets({
      baselineCore: baseline,
      currentCore: current,
      allowlist,
      baselineAllowlist: allowlist,
      ledger,
      sourceState: {},
    });
    expect(inherited.budgets.find((record) => record.budgetId.startsWith('exception:'))).toMatchObject({
      exceptionState: 'inherited',
      observedValue: 0,
    });

    const removed = evaluateFitnessBudgets({
      baselineCore: baseline,
      currentCore: current,
      allowlist: { ...allowlist, entries: [] },
      baselineAllowlist: allowlist,
      ledger,
      sourceState: {},
    });
    expect(removed.budgets.find((record) => record.budgetId.startsWith('exception:'))).toMatchObject({
      exceptionState: 'removed',
      observedValue: 0,
    });
  });

  it('projects four graph receipts as trend or observed, and blocks stale, duplicate, boundary, and heap-only receipts', () => {
    const baselineIdentity = 'baseline-census';
    const currentCommit = 'current-commit';
    const currentTree = 'current-tree';
    const manifests = GRAPH_IDS.map((graph) => graphManifest(graph, currentCommit, currentTree));
    const receipts = manifests.map((manifest) => graphReceipt(manifest, currentCommit, currentTree));
    const baselineReceipts = manifests.map((manifest) => graphReceipt(manifest, 'baseline-commit', 'baseline-tree'));
    const trend = projectCompileBudgets({ sourceCommit: currentCommit, sourceTree: currentTree, baselineIdentity, receipts, manifests, baselineReceipts });
    expect(trend.failures).toEqual([]);
    expect(trend.records.every((record) => record.status === 'trend')).toBe(true);
    const observed = projectCompileBudgets({
      sourceCommit: currentCommit,
      sourceTree: currentTree,
      baselineIdentity,
      receipts: receipts.map((receipt) => receiptWithOverrides(receipt, { peakRssBytes: null })),
      manifests,
      baselineReceipts,
    });
    expect(observed.records.every((record) => record.status === 'observed')).toBe(true);
    const blocked = projectCompileBudgets({ sourceCommit: currentCommit, sourceTree: currentTree, baselineIdentity, receipts, manifests });
    expect(blocked.records.every((record) => record.status === 'blocked')).toBe(true);
    expect(blocked.failures.some((item) => item.code === 'graph-frozen-receipt-missing')).toBe(true);
    const web = receipts[0];
    const boundary = projectCompileBudgets({
      sourceCommit: currentCommit,
      sourceTree: currentTree,
      baselineIdentity,
      receipts: receipts.map((receipt) => receipt.graph === 'web'
        ? receiptWithOverrides(receipt, { status: 'blocked', failureCodes: ['web-includes-tooling'] })
        : receipt),
      manifests,
      baselineReceipts,
    });
    expect(boundary.failures).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'production-to-tooling-blocker-receipt', identity: 'web' })]));
    const heapOnly = projectCompileBudgets({
      sourceCommit: currentCommit,
      sourceTree: currentTree,
      baselineIdentity,
      receipts: receipts.map((receipt) => receipt.graph === web.graph ? receiptWithOverrides(receipt, { tscErrorCount: 1 }) : receipt),
      manifests,
      baselineReceipts,
    });
    expect(heapOnly.failures).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'graph-tsc-errors', identity: 'web' })]));
    const duplicate = projectCompileBudgets({ sourceCommit: currentCommit, sourceTree: currentTree, baselineIdentity, receipts: [...receipts, receipts[0]], manifests, baselineReceipts });
    expect(duplicate.failures).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'graph-receipt-duplicate', identity: 'web' })]));

    const receiptDrift = projectCompileBudgets({
      sourceCommit: currentCommit,
      sourceTree: currentTree,
      baselineIdentity,
      receipts: receipts.map((receipt) => receipt.graph === 'web' ? { ...receipt, durationMs: receipt.durationMs + 1 } : receipt),
      manifests,
      baselineReceipts,
    });
    expect(receiptDrift.failures).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'graph-receipt-identity-drift', identity: 'web' })]));

    const baseline = core([]);
    const current = core([], currentCommit, currentTree);
    const allowlist = createAllowlist(baseline, 'charterhash');
    const ledger = createFitnessBudgetLedger({ baselineCore: baseline, allowlist });
    const noFrozenBaseline = evaluateFitnessBudgets({
      baselineCore: baseline,
      currentCore: current,
      allowlist,
      baselineAllowlist: allowlist,
      ledger,
      sourceState: {},
      graphReceipts: receipts,
      graphManifests: manifests,
      requireGraphInputs: true,
    });
    expect(noFrozenBaseline.failures).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'graph-frozen-receipt-missing' })]));
    expect(noFrozenBaseline.status).toBe('blocked');
    const observedWithoutFrozenRequirement = evaluateFitnessBudgets({
      baselineCore: baseline,
      currentCore: current,
      allowlist,
      baselineAllowlist: allowlist,
      ledger,
      sourceState: {},
      graphReceipts: receipts,
      graphManifests: manifests,
      requireFrozenReceipts: false,
    });
    expect(observedWithoutFrozenRequirement.failures.some((item) => item.code === 'graph-frozen-receipt-missing')).toBe(false);
    expect(observedWithoutFrozenRequirement.status).toBe('trend');
  });
});
