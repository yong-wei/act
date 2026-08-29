import { beforeAll, describe, expect, it } from 'vitest';

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
  mentionsEntrypoint,
  reduceLedgerAfterDeletion,
  retirementDigest,
  rollbackRetiredEntrypoints,
  ResourceGovernanceRetirementGateError,
  scanCandidateCallers,
  scanProtectedSurfaces,
  verifyResourceGovernanceRetirement,
  type GraphFile,
  type PostDeleteVerification,
  type ReplacementIdentity,
  type ResourceGovernanceGraph,
  type RetirementCandidate,
  type RetirementFileSystem,
  type RetirementWorktreeSnapshot,
  RETIREMENT_SCAN_ROOTS,
  RETIREMENT_SCAN_ROOT_FILES,
  RETIREMENT_SCAN_EXTENSIONS,
} from '@/lib/resource-governance-retirement';
import {
  deleteRetiredResourceGovernanceEntrypointsFromRepo,
  frozenCallerCoverageGaps,
  loadRetirementScanFiles,
} from '@/lib/resource-governance-retirement/repo-scan';
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

function passingPostDeleteVerification(ok = true): PostDeleteVerification {
  return {
    runImportBuild: () => ({ ok, command: 'vitest run --retirement-import-build' }),
    runTests: () => ({ ok, command: 'vitest run resource-governance-retirement' }),
  };
}

function captureFromGraph(
  graph: ResourceGovernanceGraph,
  overrides: Partial<RetirementWorktreeSnapshot> = {},
): () => RetirementWorktreeSnapshot {
  return () => ({
    headRevision: graph.headRevision,
    dirtyPaths: [],
    files: graph.files,
    ...overrides,
  });
}

function holdNoopLock() {
  return { release() {} };
}

function deleteRetired(
  input: Omit<Parameters<typeof deleteRetiredResourceGovernanceEntrypoints>[0], 'holdWorktreeLock'> & {
    holdWorktreeLock?: Parameters<typeof deleteRetiredResourceGovernanceEntrypoints>[0]['holdWorktreeLock'];
  },
) {
  return deleteRetiredResourceGovernanceEntrypoints({
    holdWorktreeLock: holdNoopLock,
    ...input,
  });
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
  let liveScanFiles: GraphFile[] = [];

  beforeAll(() => {
    liveScanFiles = loadRetirementScanFiles(process.cwd());
  }, 60_000);
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
    expect(compareLedgers(null, prior)).toEqual([]);
    expect(compareLedgers(null, grown)).toContain('prior-ledger-omitted:allowlist');

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

    const deletedWithoutPrior = buildDeprecationLedger({
      captureRevision: REV,
      allowlist: [],
      entries: [{ ...prior.entries[0]!, state: 'deleted', consumers: [] }],
    });
    expect(compareLedgers(null, deletedWithoutPrior).some((reason) => reason.startsWith('prior-ledger-omitted'))).toBe(true);
  });

  it('deletes only exact listed entrypoints and emits post-delete receipts', () => {
    const graph = completeGraph({});
    const manifest = readyManifest(graph, 'approve-delete');
    const fs = memoryFs({
      'src/lib/obsolete-registry-read.ts': 'export function readObsoleteRegistry() { return null; }',
    });
    const receipt = deleteRetired({
      receiptId: 'del-1',
      manifest,
      graph,
      listedPaths: ['src/lib/obsolete-registry-read.ts'],
      fs,
      captureWorktree: captureFromGraph(graph),
      postDeleteVerification: passingPostDeleteVerification(),
      deletedAt: '2026-08-28T01:00:00.000Z',
    });
    expect(receipt.status).toBe('deleted');
    expect(receipt.deletedPaths).toEqual(['src/lib/obsolete-registry-read.ts']);
    expect(receipt.postDeleteZeroCaller).toBe(true);
    expect(receipt.postDeleteImportBuild).toBe(true);
    expect(receipt.reducedLedger).not.toBeNull();
    expect(receipt.reducedLedger?.entries.find((row) => row.id === 'registry-read:obsolete-helper')).toMatchObject({
      state: 'deleted',
      consumers: [],
    });
    expect(compareLedgers(graph.currentLedger, receipt.reducedLedger!)).toEqual([]);
    expect(fs.exists('src/lib/obsolete-registry-read.ts')).toBe(false);

    const globBlocked = deleteRetired({
      receiptId: 'del-glob',
      manifest,
      graph,
      listedPaths: ['src/lib/obsolete-*'],
      fs: memoryFs({ 'src/lib/obsolete-registry-read.ts': 'x' }),
      captureWorktree: captureFromGraph(graph),
      postDeleteVerification: passingPostDeleteVerification(),
      deletedAt: '2026-08-28T01:00:00.000Z',
    });
    expect(globBlocked.status).toBe('blocked');
    expect(looksLikeDirectoryOrGlob('src/lib/obsolete-*')).toBe(true);

    const emptyListed = deleteRetired({
      receiptId: 'del-empty',
      manifest,
      graph,
      listedPaths: [],
      fs: memoryFs({ 'src/lib/obsolete-registry-read.ts': 'x' }),
      captureWorktree: captureFromGraph(graph),
      postDeleteVerification: passingPostDeleteVerification(),
      deletedAt: '2026-08-28T01:00:00.000Z',
    });
    expect(emptyListed.status).toBe('blocked');
    expect(emptyListed.reasons).toContain('listed-paths-empty');
    expect(emptyListed.reducedLedger).toBeNull();
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
    const receipt = deleteRetired({
      receiptId: 'del-race',
      manifest,
      graph: raced,
      listedPaths: ['src/lib/obsolete-registry-read.ts'],
      fs: memoryFs({ 'src/lib/obsolete-registry-read.ts': 'export function readObsoleteRegistry() {}' }),
      captureWorktree: captureFromGraph(raced),
      postDeleteVerification: passingPostDeleteVerification(),
      deletedAt: '2026-08-28T01:00:00.000Z',
    });
    expect(receipt.status).toBe('blocked');
    expect(receipt.deletedPaths).toEqual([]);
    expect(receipt.reasons.join(' ')).toMatch(/race|hidden-caller|denominator|mismatch/);
  });

  it('restores digest-verified pre-delete bytes without writing selectors or releases', () => {
    const graph = completeGraph({});
    const manifest = readyManifest(graph, 'approve-delete');
    const fs = memoryFs({
      'src/lib/obsolete-registry-read.ts': 'export function readObsoleteRegistry() { return null; }',
    });
    const receipt = deleteRetired({
      receiptId: 'del-rollback',
      manifest,
      graph,
      listedPaths: ['src/lib/obsolete-registry-read.ts'],
      fs,
      captureWorktree: captureFromGraph(graph),
      postDeleteVerification: passingPostDeleteVerification(),
      deletedAt: '2026-08-28T01:00:00.000Z',
    });
    expect(receipt.status).toBe('deleted');
    const restored = rollbackRetiredEntrypoints({ graph, fs, receipt });
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

    const liveFiles = liveScanFiles;
    const present = new Set(liveFiles.map((file) => file.path));
    const files = [
      ...liveFiles,
      ...FROZEN_CANDIDATES
        .filter((row) => !present.has(row.sourcePath))
        .map((row) => graphFile(row.sourcePath, `export const ${row.id} = true;`)),
      ...protectedPlaceholders().filter((file) => !present.has(file.path)),
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
    expect(verdict.reasons).toEqual([]);
    expect(verdict.status).toBe('retain');
    expect(verdict.deletionsAuthorized).toEqual([]);
    expect(verdict.protectedSurfacesIntact).toBe(true);
    expect(new Set(FROZEN_CANDIDATES.map((row) => row.replacement.contract))).toEqual(new Set([
      RESOURCE_REGISTRY_INDEX_CONTRACT,
      RESOURCE_ELIGIBILITY_CONTRACT,
      KNOWLEDGE_SURFACE_CONTRACT,
    ]));

    const deleteAttempt = deleteRetired({
      receiptId: 'no-live-delete',
      manifest,
      graph,
      listedPaths: ['src/lib/full-resource-path-readiness-gate.ts'],
      fs: memoryFs({ 'src/lib/full-resource-path-readiness-gate.ts': 'gate' }),
      captureWorktree: captureFromGraph(graph),
      postDeleteVerification: passingPostDeleteVerification(),
      deletedAt: '2026-08-28T02:00:00.000Z',
    });
    expect(deleteAttempt.status).toBe('blocked');
    expect(deleteAttempt.deletedPaths).toEqual([]);
  });

  it('does not treat knowledge node detail, v2, or active hrefs as list DTO callers', () => {
    const listDto = FROZEN_CANDIDATES.find((row) => row.id === 'knowledge-projection:nodes-list-array-dto')!;
    const hits = scanCandidateCallers({
      candidate: listDto,
      files: [
        graphFile('src/only-detail.ts', "fetch('/api/knowledge/nodes/' + id)"),
        graphFile('src/only-v2.ts', "fetch('/api/knowledge/nodes/v2/node-1')"),
        graphFile('src/only-active.ts', "fetch('/api/knowledge/nodes/active/node-1')"),
        graphFile('src/list-query.ts', "fetch('/api/knowledge/nodes?source=db')"),
      ],
    });
    expect(hits.map((hit) => hit.path)).toEqual(['src/list-query.ts']);
    expect(mentionsEntrypoint("fetch('/api/knowledge/nodes/v2/x')", listDto.sourcePath)).toBe(false);
    expect(mentionsEntrypoint("fetch('/api/knowledge/nodes?source=db')", listDto.sourcePath)).toBe(true);
  });

  it('covers the frozen denominator with a live repository scan', () => {
    expect(RETIREMENT_SCAN_ROOTS).toEqual(expect.arrayContaining([
      'src',
      'scripts',
      'tests',
      'artifacts',
      'course-content',
      'openspec',
      'docs',
      'prisma',
    ]));
    expect(RETIREMENT_SCAN_ROOT_FILES).toContain('package.json');
    expect(RETIREMENT_SCAN_EXTENSIONS).toEqual(expect.arrayContaining(['.yaml', '.yml']));
    const live = Object.fromEntries(
      FROZEN_CANDIDATES.map((candidate) => [
        candidate.id,
        scanCandidateCallers({ candidate, files: liveScanFiles }),
      ]),
    );
    expect(frozenCallerCoverageGaps(FROZEN_CALLERS, live)).toEqual([]);
    expect(frozenCallerCoverageGaps(live, FROZEN_CALLERS)).toEqual([]);
    expect(liveScanFiles.some((file) => file.path === 'package.json')).toBe(true);
    expect(liveScanFiles.some((file) => file.path.startsWith('docs/'))).toBe(true);
    expect(liveScanFiles.some((file) => file.path.startsWith('openspec/'))).toBe(true);
    expect(liveScanFiles.some((file) => file.path.startsWith('course-content/'))).toBe(true);
    expect(liveScanFiles.some((file) => file.path.startsWith('prisma/'))).toBe(true);

    const fallbackHits = live['registry-read:student-resources-id-metadata-fallback'] ?? [];
    expect(fallbackHits.some((hit) => hit.path.startsWith('docs/'))).toBe(true);
    expect(fallbackHits.some((hit) => hit.path.startsWith('openspec/'))).toBe(true);

    const listHits = live['knowledge-projection:nodes-list-array-dto'] ?? [];
    expect(listHits.some((hit) => hit.path.includes('knowledge-nodes-route.test.ts'))).toBe(true);
    expect(listHits.some((hit) => hit.path.includes('knowledge-db-fallback-production.real-smoke.test.ts'))).toBe(true);
    expect(listHits.some((hit) => hit.path.includes('capture-batch38.mjs'))).toBe(true);
    expect(listHits.some((hit) => hit.path === 'docs/proposals/course-knowledge-base-governance-source-registry.yaml')).toBe(true);
    expect(listHits.some((hit) => hit.path.includes('nodes/[id]') || hit.path.includes('nodes/v2') || hit.path.includes('nodes/active'))).toBe(false);
  });

  it('binds the full replacement identity into the candidate hash and rechecks it at verify time', () => {
    const base = candidate();
    const baseHash = hashCandidateSet([base]);
    const authorizationFlipped = candidate({
      replacement: {
        ...passingReplacement(),
        parity: {
          ...passingReplacement().parity,
          authorization: false,
        },
      },
    });
    const publicApiFlipped = candidate({
      replacement: {
        ...passingReplacement(),
        publicApiPath: 'src/features/knowledge/resource-index/wrong-public-api.ts',
      },
    });
    expect(hashCandidateSet([authorizationFlipped])).not.toBe(baseHash);
    expect(hashCandidateSet([publicApiFlipped])).not.toBe(baseHash);

    const goodGraph = completeGraph({});
    const goodManifest = readyManifest(goodGraph, 'approve-delete');
    const mutatedGraph = completeGraph({
      candidates: [publicApiFlipped],
    });
    const verdict = verifyResourceGovernanceRetirement(goodManifest, mutatedGraph);
    expect(verdict.status).toBe('blocked');
    expect(verdict.deletionsAuthorized).toEqual([]);
    expect(verdict.reasons.join(' ')).toMatch(/candidate-set-hash-mismatch|replacement-identity-drift/);
  });

  it('refuses deletion when the rollback archive does not cover an authorized candidate', () => {
    const graph = completeGraph({ archiveFiles: {} });
    const manifest = readyManifest(graph, 'approve-delete');
    expect(manifest.status).toBe('blocked');
    expect(manifest.reasons.some((reason) => reason.startsWith('rollback-missing-entry:'))).toBe(true);

    const verdict = verifyResourceGovernanceRetirement(manifest, graph);
    expect(verdict.status).toBe('blocked');
    expect(verdict.deletionsAuthorized).toEqual([]);
    expect(verdict.reasons.some((reason) => reason.startsWith('rollback-missing-entry:'))).toBe(true);

    const fs = memoryFs({
      'src/lib/obsolete-registry-read.ts': 'export function readObsoleteRegistry() { return null; }',
    });
    const receipt = deleteRetired({
      receiptId: 'del-empty-archive',
      manifest,
      graph,
      listedPaths: ['src/lib/obsolete-registry-read.ts'],
      fs,
      captureWorktree: captureFromGraph(graph),
      postDeleteVerification: passingPostDeleteVerification(),
      deletedAt: '2026-08-28T03:00:00.000Z',
    });
    expect(receipt.status).toBe('blocked');
    expect(receipt.deletedPaths).toEqual([]);
    expect(fs.exists('src/lib/obsolete-registry-read.ts')).toBe(true);
  });

  it('refuses deletion when the live worktree is dirty', () => {
    const graph = completeGraph({});
    const manifest = readyManifest(graph, 'approve-delete');
    const fs = memoryFs({
      'src/lib/obsolete-registry-read.ts': 'export function readObsoleteRegistry() { return null; }',
    });
    const receipt = deleteRetired({
      receiptId: 'del-dirty',
      manifest,
      graph,
      listedPaths: ['src/lib/obsolete-registry-read.ts'],
      fs,
      captureWorktree: captureFromGraph(graph, { dirtyPaths: ['src/app/unrelated.ts'] }),
      postDeleteVerification: passingPostDeleteVerification(),
      deletedAt: '2026-08-28T04:00:00.000Z',
    });
    expect(receipt.status).toBe('blocked');
    expect(receipt.reasons).toContain('worktree-dirty:src/app/unrelated.ts');
    expect(receipt.deletedPaths).toEqual([]);
    expect(fs.exists('src/lib/obsolete-registry-read.ts')).toBe(true);
  });

  it('refuses deletion when the live worktree adds a caller after the frozen graph', () => {
    const graph = completeGraph({});
    const manifest = readyManifest(graph, 'approve-delete');
    const fs = memoryFs({
      'src/lib/obsolete-registry-read.ts': 'export function readObsoleteRegistry() { return null; }',
    });
    const receipt = deleteRetired({
      receiptId: 'del-live-caller',
      manifest,
      graph,
      listedPaths: ['src/lib/obsolete-registry-read.ts'],
      fs,
      captureWorktree: captureFromGraph(graph, {
        files: [
          ...graph.files,
          graphFile(
            'src/app/new-caller.ts',
            "import { readObsoleteRegistry } from '@/lib/obsolete-registry-read';",
          ),
        ],
      }),
      postDeleteVerification: passingPostDeleteVerification(),
      deletedAt: '2026-08-28T04:01:00.000Z',
    });
    expect(receipt.status).toBe('blocked');
    expect(receipt.reasons).toContain('zero-caller-race:registry-read:obsolete-helper');
    expect(receipt.deletedPaths).toEqual([]);
    expect(fs.exists('src/lib/obsolete-registry-read.ts')).toBe(true);
  });

  it('refuses deletion when a candidate file digest drifted in the live worktree', () => {
    const graph = completeGraph({});
    const manifest = readyManifest(graph, 'approve-delete');
    const fs = memoryFs({
      'src/lib/obsolete-registry-read.ts': 'export function readObsoleteRegistry() { return null; }',
    });
    const receipt = deleteRetired({
      receiptId: 'del-digest-drift',
      manifest,
      graph,
      listedPaths: ['src/lib/obsolete-registry-read.ts'],
      fs,
      captureWorktree: captureFromGraph(graph, {
        files: graph.files.map((file) => (
          file.path === 'src/lib/obsolete-registry-read.ts'
            ? graphFile(file.path, `${file.content}\n// drifted`)
            : file
        )),
      }),
      postDeleteVerification: passingPostDeleteVerification(),
      deletedAt: '2026-08-28T04:02:00.000Z',
    });
    expect(receipt.status).toBe('blocked');
    expect(receipt.reasons).toContain('worktree-candidate-digest-drift:registry-read:obsolete-helper');
    expect(receipt.deletedPaths).toEqual([]);
    expect(fs.exists('src/lib/obsolete-registry-read.ts')).toBe(true);
  });

  it('binds postDeleteImportBuild to command results and restores on failure', () => {
    const graph = completeGraph({});
    const manifest = readyManifest(graph, 'approve-delete');
    const fs = memoryFs({
      'src/lib/obsolete-registry-read.ts': 'export function readObsoleteRegistry() { return null; }',
    });
    const receipt = deleteRetired({
      receiptId: 'del-build-fail',
      manifest,
      graph,
      listedPaths: ['src/lib/obsolete-registry-read.ts'],
      fs,
      captureWorktree: captureFromGraph(graph),
      postDeleteVerification: {
        runImportBuild: () => ({ ok: false, command: 'npm run typecheck' }),
        runTests: () => ({ ok: true, command: 'npx vitest run resource-governance-retirement' }),
      },
      deletedAt: '2026-08-28T04:03:00.000Z',
    });
    expect(receipt.status).toBe('blocked');
    expect(receipt.postDeleteImportBuild).toBe(false);
    expect(receipt.reasons).toContain('post-delete-import-build-failed:npm run typecheck');
    expect(receipt.deletedPaths).toEqual([]);
    expect(fs.exists('src/lib/obsolete-registry-read.ts')).toBe(true);
  });

  it('recaptures the live worktree immediately before unlink', () => {
    const graph = completeGraph({});
    const manifest = readyManifest(graph, 'approve-delete');
    const fs = memoryFs({
      'src/lib/obsolete-registry-read.ts': 'export function readObsoleteRegistry() { return null; }',
    });
    let captures = 0;
    const receipt = deleteRetired({
      receiptId: 'del-recapture',
      manifest,
      graph,
      listedPaths: ['src/lib/obsolete-registry-read.ts'],
      fs,
      captureWorktree: () => {
        captures += 1;
        if (captures === 1) {
          return captureFromGraph(graph)();
        }
        return captureFromGraph(graph, {
          files: [
            ...graph.files,
            graphFile(
              'src/app/late-caller.ts',
              "import { readObsoleteRegistry } from '@/lib/obsolete-registry-read';",
            ),
          ],
        })();
      },
      postDeleteVerification: passingPostDeleteVerification(),
      deletedAt: '2026-08-28T04:04:00.000Z',
    });
    expect(captures).toBe(2);
    expect(receipt.status).toBe('blocked');
    expect(receipt.reasons).toContain('zero-caller-race:registry-read:obsolete-helper');
    expect(fs.exists('src/lib/obsolete-registry-read.ts')).toBe(true);
  });

  it('restores unlinked bytes when post-delete verification throws', () => {
    const graph = completeGraph({});
    const manifest = readyManifest(graph, 'approve-delete');
    const fs = memoryFs({
      'src/lib/obsolete-registry-read.ts': 'export function readObsoleteRegistry() { return null; }',
    });
    const receipt = deleteRetired({
      receiptId: 'del-throw',
      manifest,
      graph,
      listedPaths: ['src/lib/obsolete-registry-read.ts'],
      fs,
      captureWorktree: captureFromGraph(graph),
      postDeleteVerification: {
        runImportBuild: () => {
          throw new Error('spawn failed');
        },
        runTests: () => ({ ok: true, command: 'npx vitest run resource-governance-retirement' }),
      },
      deletedAt: '2026-08-28T04:05:00.000Z',
    });
    expect(receipt.status).toBe('blocked');
    expect(receipt.reasons).toContain('post-delete-exception:spawn failed');
    expect(receipt.deletedPaths).toEqual([]);
    expect(fs.exists('src/lib/obsolete-registry-read.ts')).toBe(true);
  });

  it('does not authorize deletion from a zero-caller flag that contradicts hits', () => {
    const graph = completeGraph({});
    const protectedScan = scanProtectedSurfaces({
      captureRevision: graph.captureRevision,
      candidates: graph.candidates,
      protectedSurfaces: graph.protectedSurfaces,
      presentPaths: graph.files.map((file) => file.path),
    });
    const liarBody = {
      candidateId: 'registry-read:obsolete-helper',
      captureRevision: REV,
      scanRules: {
        exactPath: true as const,
        exactSymbol: true as const,
        includeTests: true as const,
        includeDynamic: true as const,
        includeGenerated: true as const,
        excludedFrameworkFiles: [] as string[],
      },
      hits: [{
        path: 'src/hidden-reverse.ts',
        symbol: 'readObsoleteRegistry',
        callerClass: 'reverse' as const,
        kind: 'reverse' as const,
      }],
      zeroCallers: true,
    };
    const liarReceipt = {
      ...liarBody,
      receiptDigest: retirementDigest(liarBody),
    };
    const manifest = buildResourceGovernanceRetirementManifest({
      retirementId: 'retire-test',
      graph,
      reviewedAt: '2026-08-28T00:00:00.000Z',
      reviewerDecision: 'approve-delete',
      protectedSurfaceScan: protectedScan,
      zeroCallerReceipts: [liarReceipt],
    });
    expect(manifest.status).toBe('blocked');
    expect(manifest.reasons).toContain('zero-caller-flag-mismatch:registry-read:obsolete-helper');
    const verdict = verifyResourceGovernanceRetirement(manifest, graph);
    expect(verdict.deletionsAuthorized).toEqual([]);
    expect(verdict.reasons).toContain('zero-caller-flag-mismatch:registry-read:obsolete-helper');
  });

  it('holds the worktree lock across final recapture and digest-checked unlink', () => {
    const graph = completeGraph({});
    const manifest = readyManifest(graph, 'approve-delete');
    const fs = memoryFs({
      'src/lib/obsolete-registry-read.ts': 'export function readObsoleteRegistry() { return null; }',
    });
    const events: string[] = [];
    const receipt = deleteRetired({
      receiptId: 'del-lock',
      manifest,
      graph,
      listedPaths: ['src/lib/obsolete-registry-read.ts'],
      fs,
      captureWorktree: () => {
        events.push('capture');
        return captureFromGraph(graph)();
      },
      holdWorktreeLock: () => {
        events.push('lock');
        return {
          release() {
            events.push('unlock');
          },
        };
      },
      postDeleteVerification: passingPostDeleteVerification(),
      deletedAt: '2026-08-28T04:06:00.000Z',
    });
    expect(receipt.status).toBe('deleted');
    expect(events[0]).toBe('capture');
    expect(events[1]).toBe('lock');
    expect(events[2]).toBe('capture');
    expect(events.at(-1)).toBe('unlock');
    expect(receipt.reducedLedger?.entries[0]?.state).toBe('deleted');
    expect(fs.exists('src/lib/obsolete-registry-read.ts')).toBe(false);
  });

  it('refuses unlink when on-disk bytes no longer match the verified archive digest', () => {
    const graph = completeGraph({});
    const manifest = readyManifest(graph, 'approve-delete');
    const fs = memoryFs({
      'src/lib/obsolete-registry-read.ts': 'export function readObsoleteRegistry() { return null; }\n// mutated after capture',
    });
    const receipt = deleteRetired({
      receiptId: 'del-ondisk-drift',
      manifest,
      graph,
      listedPaths: ['src/lib/obsolete-registry-read.ts'],
      fs,
      captureWorktree: captureFromGraph(graph),
      postDeleteVerification: passingPostDeleteVerification(),
      deletedAt: '2026-08-28T04:07:00.000Z',
    });
    expect(receipt.status).toBe('blocked');
    expect(receipt.reasons).toContain('pre-unlink-digest-mismatch:src/lib/obsolete-registry-read.ts');
    expect(receipt.reducedLedger).toBeNull();
    expect(fs.exists('src/lib/obsolete-registry-read.ts')).toBe(true);
    expect(() => rollbackRetiredEntrypoints({ graph, fs, receipt })).toThrow(
      ResourceGovernanceRetirementGateError,
    );
  });

  it('does not authorize deletion when the ledger entry is missing or not retained', () => {
    const missingLedger = completeGraph({ ledgerEntries: [] });
    const missingManifest = readyManifest(missingLedger, 'approve-delete');
    expect(missingManifest.status).toBe('retain');
    expect(verifyResourceGovernanceRetirement(missingManifest, missingLedger).deletionsAuthorized).toEqual([]);

    const retainedPrior = buildDeprecationLedger({
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
        deletionCondition: 'already retired',
        rollbackIdentity: REV,
      }],
    });
    const deletedLedger = completeGraph({
      priorAllowlist: retainedPrior,
      ledgerEntries: [{
        id: 'registry-read:obsolete-helper',
        owner: 'knowledge',
        sourcePath: 'src/lib/obsolete-registry-read.ts',
        consumers: [],
        replacement: RESOURCE_REGISTRY_INDEX_CONTRACT,
        migrationRevision: REV,
        state: 'deleted',
        deletionCondition: 'already retired',
        rollbackIdentity: REV,
      }],
    });
    const deletedManifest = readyManifest(deletedLedger, 'approve-delete');
    expect(deletedManifest.status).toBe('retain');
    expect(verifyResourceGovernanceRetirement(deletedManifest, deletedLedger).deletionsAuthorized).toEqual([]);
  });

  it('records a reduced ledger with deleted state after a successful exact-path delete', () => {
    const graph = completeGraph({});
    const reduced = reduceLedgerAfterDeletion(
      graph.currentLedger,
      ['src/lib/obsolete-registry-read.ts'],
    );
    expect(reduced.entries[0]?.state).toBe('deleted');
    expect(reduced.entries[0]?.consumers).toEqual([]);
    expect(compareLedgers(graph.currentLedger, reduced)).toEqual([]);
  });

  it('exposes a production deletion entry that binds the real worktree lock', () => {
    expect(typeof deleteRetiredResourceGovernanceEntrypointsFromRepo).toBe('function');
  });

  it('restores only receipt deletedPaths and leaves other archived files untouched', () => {
    const extra = candidate({
      id: 'registry-read:other-retained',
      sourcePath: 'src/lib/other-retained.ts',
      exportName: 'otherRetained',
    });
    const graph = completeGraph({
      candidates: [candidate(), extra],
      extraFiles: [graphFile('src/lib/other-retained.ts', 'export const other = true;')],
      archiveFiles: {
        'src/lib/obsolete-registry-read.ts': 'export function readObsoleteRegistry() { return null; }',
        'src/lib/other-retained.ts': 'export const other = true;',
      },
    });
    const manifest = readyManifest(graph, 'approve-delete');
    const fs = memoryFs({
      'src/lib/obsolete-registry-read.ts': 'export function readObsoleteRegistry() { return null; }',
      'src/lib/other-retained.ts': 'export const other = "live-edit";',
    });
    const receipt = deleteRetired({
      receiptId: 'del-one-of-two',
      manifest,
      graph,
      listedPaths: ['src/lib/obsolete-registry-read.ts'],
      fs,
      captureWorktree: captureFromGraph(graph),
      postDeleteVerification: passingPostDeleteVerification(),
      deletedAt: '2026-08-28T01:00:00.000Z',
    });
    expect(receipt.status).toBe('deleted');
    expect(fs.exists('src/lib/obsolete-registry-read.ts')).toBe(false);
    const restored = rollbackRetiredEntrypoints({ graph, fs, receipt });
    expect(restored.restored).toEqual(['src/lib/obsolete-registry-read.ts']);
    expect(fs.read('src/lib/obsolete-registry-read.ts')).toContain('readObsoleteRegistry');
    expect(fs.read('src/lib/other-retained.ts')).toBe('export const other = "live-edit";');
  });

  it('restores earlier unlinks when a later listed path fails the digest check', () => {
    const first = candidate({
      id: 'registry-read:one',
      sourcePath: 'src/lib/one.ts',
      exportName: 'readOne',
    });
    const second = candidate({
      id: 'registry-read:two',
      sourcePath: 'src/lib/two.ts',
      exportName: 'readTwo',
    });
    const oneSrc = 'export function readOne() { return 1; }';
    const twoSrc = 'export function readTwo() { return 2; }';
    const graph = completeGraph({
      candidates: [first, second],
      extraFiles: [
        graphFile('src/lib/one.ts', oneSrc),
        graphFile('src/lib/two.ts', twoSrc),
      ],
      archiveFiles: {
        'src/lib/one.ts': oneSrc,
        'src/lib/two.ts': twoSrc,
      },
    });
    const manifest = readyManifest(graph, 'approve-delete');
    const fs = memoryFs({
      'src/lib/one.ts': oneSrc,
      'src/lib/two.ts': `${twoSrc}\n// mutated`,
    });
    const receipt = deleteRetired({
      receiptId: 'del-partial',
      manifest,
      graph,
      listedPaths: ['src/lib/one.ts', 'src/lib/two.ts'],
      fs,
      captureWorktree: captureFromGraph(graph),
      postDeleteVerification: passingPostDeleteVerification(),
      deletedAt: '2026-08-28T01:10:00.000Z',
    });
    expect(receipt.status).toBe('blocked');
    expect(receipt.reasons).toContain('pre-unlink-digest-mismatch:src/lib/two.ts');
    expect(fs.exists('src/lib/one.ts')).toBe(true);
    expect(fs.read('src/lib/one.ts')).toBe(oneSrc);
    expect(fs.exists('src/lib/two.ts')).toBe(true);
  });

  it('requires every declared protected path to remain present', () => {
    const scan = scanProtectedSurfaces({
      captureRevision: REV,
      candidates: [candidate()],
      protectedSurfaces: [{
        id: 'runtime-release-readers',
        issueRefs: ['#1498'],
        paths: ['src/lib/course-runtime.ts', 'src/app/api/course-runtime'],
        reason: 'Immutable Runtime Release readers',
      }],
      presentPaths: ['src/lib/course-runtime.ts'],
    });
    expect(scan.intact).toBe(false);
    expect(scan.missingProtected).toContain('runtime-release-readers:src/app/api/course-runtime');
  });
});
