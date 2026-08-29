import { describe, expect, it } from 'vitest';

import {
  CLEAN_CHANGE_SURFACE,
  FROZEN_CALLERS,
  FROZEN_CANDIDATES,
  FROZEN_CAPTURE_REVISION,
  PROTECTED_SURFACES,
  buildDeprecationLedger,
  buildResourceGovernanceRetirementManifest,
  buildRollbackArchive,
  buildZeroCallerReceipt,
  compareLedgers,
  deleteRetiredResourceGovernanceEntrypoints,
  fileDigest,
  hashCandidateSet,
  hashDenominator,
  looksLikeDirectoryOrGlob,
  rollbackRetiredEntrypoints,
  scanProtectedSurfaces,
  verifyResourceGovernanceRetirement,
  type GraphFile,
  type ReplacementIdentity,
  type ResourceGovernanceGraph,
  type RetirementCandidate,
  type RetirementFileSystem,
} from '@/lib/resource-governance-retirement';
import { RESOURCE_REGISTRY_INDEX_CONTRACT } from '@/features/knowledge/resource-index/public-api';
import { RESOURCE_ELIGIBILITY_CONTRACT } from '@/features/knowledge/resource-eligibility/public-api';
import { KNOWLEDGE_SURFACE_CONTRACT } from '@/lib/knowledge-surface';

const REV = 'a'.repeat(40);
const OTHER_REV = 'b'.repeat(40);

function passingReplacement(contract: ReplacementIdentity['contract'] = RESOURCE_REGISTRY_INDEX_CONTRACT): ReplacementIdentity {
  return {
    contract,
    publicApiPath: 'src/features/knowledge/resource-index/public-api.ts',
    publicSymbol: 'resolveStudentVisibleIndexedResource',
    implemented: true,
    captureRevision: REV,
    parity: {
      identity: true,
      sourceOwnership: true,
      role: true,
      authorization: true,
      scope: true,
      revision: true,
      optionalDegradation: true,
      failClosed: true,
      cache: true,
      publicResponse: true,
      facade: false,
    },
  };
}

function candidate(overrides: Partial<RetirementCandidate> = {}): RetirementCandidate {
  return {
    id: 'registry-read:obsolete-helper',
    owner: 'knowledge',
    sourcePath: 'src/lib/obsolete-registry-read.ts',
    exportName: 'readObsoleteRegistry',
    semanticRole: 'registry-read',
    replacement: passingReplacement(),
    migrationRevision: REV,
    retireable: true,
    deletionCondition: 'zero callers after R1 migration',
    ...overrides,
  };
}

function memoryFs(initial: Record<string, string>): RetirementFileSystem & { files: Record<string, string> } {
  const files = { ...initial };
  return {
    files,
    exists: (path) => path in files,
    isDirectory: (path) => path.endsWith('/'),
    read: (path) => files[path] ?? '',
    unlink: (path) => {
      delete files[path];
    },
    write: (path, content) => {
      files[path] = content;
    },
  };
}

function graphFile(path: string, content: string): GraphFile {
  return { path, content, digest: fileDigest(content) };
}

function protectedPlaceholders(): GraphFile[] {
  return PROTECTED_SURFACES.flatMap((surface) =>
    surface.paths.map((path) => graphFile(path, `protected:${surface.id}`)),
  );
}

function completeGraph(input: {
  candidates?: RetirementCandidate[];
  callers?: ResourceGovernanceGraph['callersByCandidate'];
  extraFiles?: GraphFile[];
  captureRevision?: string;
  headRevision?: string;
  priorAllowlist?: ResourceGovernanceGraph['priorLedger'];
  ledgerEntries?: Parameters<typeof buildDeprecationLedger>[0]['entries'];
  changeSurface?: ResourceGovernanceGraph['changeSurface'];
  archiveFiles?: Record<string, string>;
}): ResourceGovernanceGraph {
  const candidates = input.candidates ?? [candidate()];
  const callers = input.callers ?? Object.fromEntries(candidates.map((row) => [row.id, []]));
  const captureRevision = input.captureRevision ?? REV;
  const files = [
    graphFile('src/lib/obsolete-registry-read.ts', 'export function readObsoleteRegistry() { return null; }'),
    graphFile('src/features/knowledge/resource-index/public-api.ts', 'export function resolveStudentVisibleIndexedResource() {}'),
    ...protectedPlaceholders(),
    ...(input.extraFiles ?? []),
  ];
  const archiveFiles = input.archiveFiles ?? {
    'src/lib/obsolete-registry-read.ts': 'export function readObsoleteRegistry() { return null; }',
  };
  const ledger = buildDeprecationLedger({
    captureRevision,
    allowlist: [],
    entries: input.ledgerEntries ?? candidates.map((row) => ({
      id: row.id,
      owner: row.owner,
      sourcePath: row.sourcePath,
      consumers: (callers[row.id] ?? []).map((hit) => hit.path),
      replacement: row.replacement.contract,
      migrationRevision: row.migrationRevision,
      state: 'retained' as const,
      deletionCondition: row.deletionCondition,
      rollbackIdentity: captureRevision,
    })),
  });
  return {
    captureRevision,
    headRevision: input.headRevision ?? captureRevision,
    files,
    candidates,
    callersByCandidate: callers,
    protectedSurfaces: PROTECTED_SURFACES,
    priorLedger: input.priorAllowlist ?? null,
    currentLedger: ledger,
    rollbackArchive: buildRollbackArchive({
      captureRevision,
      files: archiveFiles,
      candidateIdsByPath: Object.fromEntries(
        candidates.map((row) => [row.sourcePath, row.id]),
      ),
    }),
    archiveBytes: archiveFiles,
    changeSurface: input.changeSurface ?? CLEAN_CHANGE_SURFACE,
    excludedFrameworkFiles: [],
  };
}

function readyManifest(graph: ResourceGovernanceGraph, decision: 'retain' | 'approve-delete' = 'approve-delete') {
  const protectedScan = scanProtectedSurfaces({
    captureRevision: graph.captureRevision,
    candidates: graph.candidates,
    protectedSurfaces: graph.protectedSurfaces,
    presentPaths: graph.files.map((file) => file.path),
  });
  const receipts = graph.candidates.map((row) =>
    buildZeroCallerReceipt({
      candidate: row,
      captureRevision: graph.captureRevision,
      hits: graph.callersByCandidate[row.id] ?? [],
    }),
  );
  return buildResourceGovernanceRetirementManifest({
    retirementId: 'retire-test',
    graph,
    reviewedAt: '2026-08-28T00:00:00.000Z',
    reviewerDecision: decision,
    protectedSurfaceScan: protectedScan,
    zeroCallerReceipts: receipts,
  });
}

describe('resource-governance retirement evidence gate (#1592)', () => {
  it('blocks deletion when evidence is incomplete, mixed, or mismatched', () => {
    const mixed = completeGraph({ captureRevision: REV, headRevision: OTHER_REV });
    const mixedManifest = readyManifest(mixed, 'retain');
    expect(mixedManifest.status).toBe('blocked');
    expect(mixedManifest.reasons).toContain('capture-head-revision-mismatch');

    const complete = completeGraph({});
    const good = readyManifest(complete, 'approve-delete');
    const stale = {
      ...good,
      captureRevision: OTHER_REV,
      manifestDigest: '0'.repeat(64),
    };
    const staleVerdict = verifyResourceGovernanceRetirement(stale, complete);
    expect(staleVerdict.status).toBe('blocked');
    expect(staleVerdict.deletionsAuthorized).toEqual([]);
    expect(staleVerdict.reasons.join(' ')).toMatch(/stale|tamper|mismatch/);

    const missingDenom = completeGraph({
      callers: {},
    });
    const missingManifest = readyManifest(missingDenom, 'approve-delete');
    expect(missingManifest.reasons.some((reason) => reason.startsWith('denominator-missing-candidate:'))).toBe(true);
  });

  it('retains an entrypoint that is not replaced by R1/R2/R3 and rejects a facade', () => {
    const unimplemented = completeGraph({
      candidates: [candidate({
        replacement: {
          ...passingReplacement(),
          implemented: false,
          contract: RESOURCE_REGISTRY_INDEX_CONTRACT,
        },
      })],
    });
    const unimplementedManifest = readyManifest(unimplemented);
    expect(unimplementedManifest.status).toBe('blocked');
    expect(unimplementedManifest.reasons.some((reason) => reason.includes('not-replaced') || reason.includes('not-implemented'))).toBe(true);

    const facade = completeGraph({
      candidates: [candidate({
        replacement: {
          ...passingReplacement(),
          parity: {
            ...passingReplacement().parity,
            facade: true,
          },
        },
      })],
    });
    const facadeManifest = readyManifest(facade);
    expect(facadeManifest.status).toBe('blocked');
    expect(facadeManifest.reasons.some((reason) => reason.includes('facade'))).toBe(true);
  });

  it('fails the zero-caller gate when a hidden caller remains', () => {
    const hidden = completeGraph({
      callers: {
        'registry-read:obsolete-helper': [
          {
            path: 'src/app/api/resources/[id]/route.ts',
            symbol: 'readObsoleteRegistry',
            callerClass: 'route-api',
            kind: 'import',
          },
        ],
      },
      extraFiles: [
        graphFile(
          'src/app/api/resources/[id]/route.ts',
          "import { readObsoleteRegistry } from '@/lib/obsolete-registry-read';",
        ),
      ],
    });
    const manifest = readyManifest(hidden, 'approve-delete');
    expect(manifest.status).toBe('retain');
    const verdict = verifyResourceGovernanceRetirement(manifest, hidden);
    expect(verdict.status).toBe('retain');
    expect(verdict.deletionsAuthorized).toEqual([]);
    expect(verdict.retained[0]?.deletionCondition).toContain('zero callers');
  });

  it('authorizes deletion after revision-bound replacement and empty post-migration scan', () => {
    const graph = completeGraph({});
    const manifest = readyManifest(graph, 'approve-delete');
    expect(manifest.status).toBe('ready-for-deletion');
    expect(manifest.candidateSetHash).toBe(hashCandidateSet(graph.candidates));
    expect(manifest.denominatorHash).toBe(hashDenominator(graph.callersByCandidate));
    const verdict = verifyResourceGovernanceRetirement(manifest, graph);
    expect(verdict.status).toBe('ready-for-deletion');
    expect(verdict.deletionsAuthorized).toEqual(['registry-read:obsolete-helper']);
  });

  it('retains a candidate reachable from history, rollback, or protected owners', () => {
    const protectedCandidate = candidate({
      id: 'eligibility:resource-node-aggregate-ready',
      sourcePath: 'src/lib/resource-node-registry.ts',
      exportName: 'readiness',
    });
    const graph = completeGraph({
      candidates: [protectedCandidate],
      callers: { 'eligibility:resource-node-aggregate-ready': [] },
    });
    const manifest = readyManifest(graph, 'approve-delete');
    const verdict = verifyResourceGovernanceRetirement(manifest, graph);
    expect(verdict.deletionsAuthorized).toEqual([]);
    expect(verdict.retained.some((row) => row.id === protectedCandidate.id)).toBe(true);
    expect(verdict.protectedSurfacesIntact).toBe(true);
  });

  it('rejects allowlist growth and unexplained resurrection, and records a reduced ledger after deletion', () => {
    const prior = buildDeprecationLedger({
      captureRevision: REV,
      allowlist: [],
      entries: [{
        id: 'registry-read:obsolete-helper',
        owner: 'knowledge',
        sourcePath: 'src/lib/obsolete-registry-read.ts',
        consumers: [],
        replacement: RESOURCE_REGISTRY_INDEX_CONTRACT,
        migrationRevision: REV,
        state: 'retained',
        deletionCondition: 'zero callers',
        rollbackIdentity: REV,
      }],
    });
    const grown = buildDeprecationLedger({
      captureRevision: REV,
      allowlist: [{ id: 'compat:*', pattern: 'src/**', reason: 'avoid deletion' }],
      entries: prior.entries,
    });
    expect(compareLedgers(prior, grown).some((reason) => reason.includes('allowlist'))).toBe(true);

    const resurrected = buildDeprecationLedger({
      captureRevision: REV,
      allowlist: [],
      entries: [{
        ...prior.entries[0]!,
        state: 'retained',
      }],
    });
    const deletedPrior = buildDeprecationLedger({
      captureRevision: REV,
      allowlist: [],
      entries: [{ ...prior.entries[0]!, state: 'deleted' }],
    });
    expect(compareLedgers(deletedPrior, resurrected)).toContain('ledger-resurrection:registry-read:obsolete-helper');

    const reduced = buildDeprecationLedger({
      captureRevision: REV,
      allowlist: [],
      entries: [{ ...prior.entries[0]!, state: 'deleted', consumers: [] }],
    });
    expect(compareLedgers(prior, reduced)).toEqual([]);
  });

  it('deletes only exact listed entrypoints and emits post-delete receipts', () => {
    const graph = completeGraph({});
    const manifest = readyManifest(graph, 'approve-delete');
    const fs = memoryFs({
      'src/lib/obsolete-registry-read.ts': 'export function readObsoleteRegistry() { return null; }',
    });
    const receipt = deleteRetiredResourceGovernanceEntrypoints({
      receiptId: 'del-1',
      manifest,
      graph,
      listedPaths: ['src/lib/obsolete-registry-read.ts'],
      fs,
      deletedAt: '2026-08-28T01:00:00.000Z',
    });
    expect(receipt.status).toBe('deleted');
    expect(receipt.deletedPaths).toEqual(['src/lib/obsolete-registry-read.ts']);
    expect(receipt.postDeleteZeroCaller).toBe(true);
    expect(receipt.postDeleteImportBuild).toBe(true);
    expect(fs.exists('src/lib/obsolete-registry-read.ts')).toBe(false);

    const globBlocked = deleteRetiredResourceGovernanceEntrypoints({
      receiptId: 'del-glob',
      manifest,
      graph,
      listedPaths: ['src/lib/obsolete-*'],
      fs: memoryFs({ 'src/lib/obsolete-registry-read.ts': 'x' }),
      deletedAt: '2026-08-28T01:00:00.000Z',
    });
    expect(globBlocked.status).toBe('blocked');
    expect(looksLikeDirectoryOrGlob('src/lib/obsolete-*')).toBe(true);
  });

  it('fails closed when a caller appears between scan and deletion', () => {
    const graph = completeGraph({});
    const manifest = readyManifest(graph, 'approve-delete');
    const raced: ResourceGovernanceGraph = {
      ...graph,
      files: [
        ...graph.files,
        graphFile(
          'src/lib/sneaky-caller.ts',
          "import { readObsoleteRegistry } from '@/lib/obsolete-registry-read';",
        ),
      ],
    };
    const receipt = deleteRetiredResourceGovernanceEntrypoints({
      receiptId: 'del-race',
      manifest,
      graph: raced,
      listedPaths: ['src/lib/obsolete-registry-read.ts'],
      fs: memoryFs({ 'src/lib/obsolete-registry-read.ts': 'export function readObsoleteRegistry() {}' }),
      deletedAt: '2026-08-28T01:00:00.000Z',
    });
    expect(receipt.status).toBe('blocked');
    expect(receipt.deletedPaths).toEqual([]);
    expect(receipt.reasons.join(' ')).toMatch(/race|hidden-caller|denominator|mismatch/);
  });

  it('restores digest-verified pre-delete bytes without writing selectors or releases', () => {
    const graph = completeGraph({});
    const fs = memoryFs({});
    const restored = rollbackRetiredEntrypoints({ graph, fs });
    expect(restored.restored).toContain('src/lib/obsolete-registry-read.ts');
    expect(fs.read('src/lib/obsolete-registry-read.ts')).toContain('readObsoleteRegistry');
    expect(graph.changeSurface.writesSelectors).toBe(false);
    expect(graph.changeSurface.writesRuntimeRelease).toBe(false);
    expect(graph.changeSurface.writesAuthority).toBe(false);
  });

  it('freezes the R3-merged denominator and retains live resource-governance entrypoints', () => {
    expect(FROZEN_CAPTURE_REVISION).toMatch(/^[a-f0-9]{40}$/);
    expect(hashCandidateSet(FROZEN_CANDIDATES)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashDenominator(FROZEN_CALLERS)).toMatch(/^[a-f0-9]{64}$/);

    const files = [
      ...FROZEN_CANDIDATES.map((row) => graphFile(row.sourcePath, `export const ${row.id} = true;`)),
      graphFile('src/features/knowledge/resource-index/public-api.ts', 'export function resolveStudentVisibleIndexedResource() {}'),
      graphFile('src/features/knowledge/resource-eligibility/public-api.ts', 'export function evaluateResourceEligibility() {}'),
      graphFile('src/lib/knowledge-surface/read.ts', 'export function readKnowledgeSurface() {}'),
      ...protectedPlaceholders(),
      ...Object.values(FROZEN_CALLERS).flat().map((hit) => graphFile(hit.path, String(hit.symbol))),
    ];
    const ledger = buildDeprecationLedger({
      captureRevision: FROZEN_CAPTURE_REVISION,
      allowlist: [],
      entries: FROZEN_CANDIDATES.map((candidate) => ({
        id: candidate.id,
        owner: candidate.owner,
        sourcePath: candidate.sourcePath,
        consumers: (FROZEN_CALLERS[candidate.id] ?? []).map((hit) => hit.path),
        replacement: candidate.replacement.contract,
        migrationRevision: candidate.migrationRevision,
        state: candidate.retireable ? 'retained' : 'already-absent',
        deletionCondition: candidate.deletionCondition,
        rollbackIdentity: FROZEN_CAPTURE_REVISION,
      })),
    });
    const archiveFiles = Object.fromEntries(
      FROZEN_CANDIDATES.map((row) => [row.sourcePath, `export const ${row.id} = true;`]),
    );
    const graph: ResourceGovernanceGraph = {
      captureRevision: FROZEN_CAPTURE_REVISION,
      headRevision: FROZEN_CAPTURE_REVISION,
      files,
      candidates: FROZEN_CANDIDATES,
      callersByCandidate: FROZEN_CALLERS,
      protectedSurfaces: PROTECTED_SURFACES,
      priorLedger: null,
      currentLedger: ledger,
      rollbackArchive: buildRollbackArchive({
        captureRevision: FROZEN_CAPTURE_REVISION,
        files: archiveFiles,
      }),
      archiveBytes: archiveFiles,
      changeSurface: CLEAN_CHANGE_SURFACE,
      excludedFrameworkFiles: [],
    };
    const manifest = readyManifest(graph, 'retain');
    expect(manifest.status).toBe('retain');
    const verdict = verifyResourceGovernanceRetirement(manifest, graph);
    expect(verdict.status).toBe('retain');
    expect(verdict.deletionsAuthorized).toEqual([]);
    expect(verdict.protectedSurfacesIntact).toBe(true);
    expect(new Set(FROZEN_CANDIDATES.map((row) => row.replacement.contract))).toEqual(new Set([
      RESOURCE_REGISTRY_INDEX_CONTRACT,
      RESOURCE_ELIGIBILITY_CONTRACT,
      KNOWLEDGE_SURFACE_CONTRACT,
    ]));

    const deleteAttempt = deleteRetiredResourceGovernanceEntrypoints({
      receiptId: 'no-live-delete',
      manifest,
      graph,
      listedPaths: ['src/lib/full-resource-path-readiness-gate.ts'],
      fs: memoryFs({ 'src/lib/full-resource-path-readiness-gate.ts': 'gate' }),
      deletedAt: '2026-08-28T02:00:00.000Z',
    });
    expect(deleteAttempt.status).toBe('blocked');
    expect(deleteAttempt.deletedPaths).toEqual([]);
  });
});
