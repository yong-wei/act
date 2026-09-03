import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  classifyBlobPayloadClass,
  classifyMaterialLayer,
  generatePostConvergenceSuccessor,
  loadSuccessorPredecessors,
  predecessorOverwriteFailures,
  qualifyPostConvergence,
  successorOverwriteFailures,
  successorPackageDigest,
  successorPreconditionFailures,
  successorWriteGate,
  verifySuccessorArtifacts,
  type PostConvergenceInput,
  type SuccessorPredecessors,
} from '@/lib/architecture-census/post-convergence';
import {
  CURRENT_HEAD_DELTA_SCHEMA_VERSION,
  createMeasurementReceipt,
  snapshotFromFiles,
  serializeDeterministic,
  sha256Text,
  INVENTORY_KINDS,
  type CaptureIdentity,
  type CensusSourceFile,
  type MeasurementReceipt,
} from '@/lib/architecture-census';

const identity: CaptureIdentity = {
  sourceCommit: 'c'.repeat(40),
  sourceTree: 'd'.repeat(40),
  commitTime: '2026-09-03T00:00:00Z',
  nodeVersion: 'v22.0.0',
  npmVersion: '11.0.0',
  typescriptVersion: '5.8.3',
};

function file(path: string, content: string): CensusSourceFile {
  return { path, content, byteLength: Buffer.byteLength(content) };
}

function binary(path: string, bytes = 16): CensusSourceFile {
  return { path, content: '', byteLength: bytes };
}

function makePredecessors(kindSet: readonly string[] = [...INVENTORY_KINDS].sort()): SuccessorPredecessors {
  return {
    baseline: {
      schemaVersion: 'act-architecture-census/v1',
      sourceCommit: 'a'.repeat(40),
      sourceTree: 'b'.repeat(40),
      censusCoreSha256: 'f'.repeat(64),
      receiptSchemaVersion: 'act-architecture-measurement-receipt/v1',
      receiptIds: ['1'.repeat(64), '2'.repeat(64)],
    },
    currentHead: {
      schemaVersion: CURRENT_HEAD_DELTA_SCHEMA_VERSION,
      sourceCommit: 'e'.repeat(40),
      sourceTree: '9'.repeat(40),
      packageSha256: '0'.repeat(64),
    },
    currentHeadPackage: {
      schemaVersion: CURRENT_HEAD_DELTA_SCHEMA_VERSION,
      captureIdentity: identity,
      captureTime: identity.commitTime,
      predecessor: {
        schemaVersion: 'act-architecture-census/v1',
        sourceCommit: 'a'.repeat(40),
        sourceTree: 'b'.repeat(40),
        censusCoreSha256: 'f'.repeat(64),
        receiptSchemaVersion: 'act-architecture-measurement-receipt/v1',
        receiptIds: [],
      },
      commandScope: 'fixture',
      toolVersions: {},
      slices: {
        'owner-conflict': { discovered: 0, represented: 0, excluded: 0, duplicate: 0, unresolved: 0 },
        retirement: { discovered: 0, represented: 0, excluded: 0, duplicate: 0, unresolved: 0 },
        hotspot: { discovered: 0, represented: 0, excluded: 0, duplicate: 0, unresolved: 0 },
      },
      records: [
        {
          id: 'retirement:src/features/adaptive/legacy-ui.tsx',
          category: 'retirement',
          identity: 'src/features/adaptive/legacy-ui.tsx',
          sourceCommit: 'e'.repeat(40),
          sourceTree: '9'.repeat(40),
          currentOwnerEvidence: ['feature:adaptive'],
          candidateTargetOwners: ['personalization'],
          consumers: [{ path: 'src/app/page.tsx', kind: 'production', relationship: 'import' }],
          consumerClass: 'production',
          deletionCondition: 'zero-production-consumers',
          rollbackReference: 'predecessor:a',
          evidence: ['src/features/adaptive/legacy-ui.tsx'],
          trustBoundary: null,
          observationVsFinding: 'unresolved',
          notes: [],
          attributes: {},
        },
      ],
      openspecConflicts: [],
      exclusions: [],
    },
    predecessorKindSet: kindSet,
  };
}

function makeReceipt(sourceCommit = identity.sourceCommit, capturedAt = '2026-09-03T00:00:00Z'): MeasurementReceipt {
  return createMeasurementReceipt({
    sourceCommit,
    sourceTree: identity.sourceTree,
    command: 'npx vitest run --reporter=json',
    scope: 'vitest unit',
    platform: 'darwin-arm64',
    toolVersions: { node: 'v22.0.0' },
    cacheMode: 'cold',
    capturedAt,
    exitStatus: 0,
    aggregate: { passed: 10, failed: 0 },
    fingerprints: ['vitest:ok'],
  });
}

function coreFixtureFiles(): CensusSourceFile[] {
  return [
    file('package.json', JSON.stringify({
      scripts: { lint: 'eslint .', typecheck: 'tsc', test: 'vitest', 'verify:commit': 'tsc' },
    })),
    file('prisma/schema.prisma', 'model User {\n  id String @id\n}\n'),
    file('src/app/api/assessment/attempt/route.ts', 'import { api } from "@/features/assessment/public-api";\nexport function GET() { return api; }\n'),
    file('src/app/assessment/page.tsx', 'import { panel } from "@/features/assessment/index";\nexport default function Page() { return panel; }\n'),
    file('src/features/assessment/public-api.ts', 'export const api = 1;\n'),
    file('src/features/assessment/index.ts', 'export const panel = 1;\n'),
    file('src/features/assessment/types.ts', 'export interface Attempt {\n  id: string;\n}\n'),
    file('src/features/personalization/path-planning/assemble.ts', 'import { api } from "@/features/assessment/public-api";\nimport { Attempt } from "@/features/assessment/types";\nimport { ok } from "@/lib/shared-result";\nexport const plan: Attempt = { id: api && ok ? "a" : "x" };\n'),
    file('src/features/personalization/path-planning/app-bridge.ts', 'import { panel } from "@/app/assessment/page";\nexport const bridge = panel;\n'),
    file('src/features/course-planning/assemble.ts', 'import { api } from "@/features/assessment/public-api";\nimport { ok } from "@/lib/shared-result";\nexport const plan = api && ok;\n'),
    file('src/lib/shared-result.ts', 'export const ok = 1;\n'),
    file('src/lib/orphan-module.ts', 'export const orphan = 1;\n'),
    file('src/lib/legacy-bridge.ts', 'export * from "@/features/assessment/public-api";\nexport * from "@/features/personalization/path-planning/assemble";\n'),
    file('src/lib/delegate-only.ts', 'export * from "@/lib/shared-result";\n'),
    file('src/features/assessment/api-contract.ts', 'export type Contract = string;\n'),
    file('src/lib/orphan/orphan.ts', 'export const x = 1;\n'),
    file('src/lib/orphan/orphan.test.ts', 'import { x } from "@/lib/orphan/orphan";\ntest("x", () => { expect(x).toBe(1); });\n'),
    file('src/lib/cycle-a.ts', 'import { b } from "@/lib/cycle-b";\nexport const a = 1;\n'),
    file('src/lib/cycle-b.ts', 'import { a } from "@/lib/cycle-a";\nexport const b = a;\n'),
    file('scripts/deploy.sh', 'echo deploy\n'),
    file('openspec/specs/demo/spec.md', '# Demo\n'),
    file('openspec/changes/archive/2026-01-01-old/proposal.md', '# Old\n'),
    file('course-content/authoring/lessons/1-1/notes/demo.md', '# Lesson\n'),
    file('course-content/runtime/lessons/1-1/manifest.json', '{}\n'),
    binary('course-content/authoring/lessons/1-1/media/intro.png', 2048),
    binary('course-content/runtime/lessons/1-1/media/intro.png', 2048),
    binary('course-content/runtime/lessons/2-1/media/unique-runtime.png', 256),
    binary('course-content/authoring/lessons/2-2/media/unique-authoring.png', 128),
    binary('artifacts/qa-evidence/session.png', 512),
    binary('artifacts/qa-evidence/session2.png', 512),
    file('.github/workflows/ci.yml', 'name: ci\n'),
  ];
}

function makeInput(files: readonly CensusSourceFile[], overrides: Partial<PostConvergenceInput> = {}): PostConvergenceInput {
  const snapshot = snapshotFromFiles(identity, [...files]);
  const blobIndex = new Map(snapshot.files.map((item) => [item.path, sha256Text(item.content || item.path)]));
  const gitBytes = new Map(snapshot.files.map((item) => [item.path, item.byteLength]));
  blobIndex.set('course-content/runtime/lessons/1-1/media/intro.png', blobIndex.get('course-content/authoring/lessons/1-1/media/intro.png')!);
  blobIndex.set('artifacts/qa-evidence/session2.png', blobIndex.get('artifacts/qa-evidence/session.png')!);
  return {
    snapshot,
    originIntegrationCommit: identity.sourceCommit,
    predecessors: makePredecessors(),
    receipts: [makeReceipt()],
    blobIndex,
    gitBytes,
    changeCounts: new Map([['src/features/assessment/public-api.ts', 7]]),
    ...overrides,
  };
}

function locatorReader(result: ReturnType<typeof generatePostConvergenceSuccessor>) {
  const contents = new Map<string, string>([
    ...Object.entries(result.files).map(([name, content]) => [name, content] as const),
    ...result.detail.map((artifact) => [artifact.logicalLocator, artifact.content] as const),
  ]);
  return (locator: string): string => {
    const content = contents.get(locator);
    if (content === undefined) throw new Error(`missing:${locator}`);
    return content;
  };
}

describe('post-convergence successor capture', () => {
  it('classifies every tracked path into exactly one material layer and reconciles totals', () => {
    expect(classifyMaterialLayer('src/lib/x.ts')).toBe('hand-authored-production');
    expect(classifyMaterialLayer('src/lib/x.test.ts')).toBe('tests');
    expect(classifyMaterialLayer('scripts/a.ts')).toBe('tools-scripts');
    expect(classifyMaterialLayer('course-content/authoring/a.md')).toBe('authored-course-content');
    expect(classifyMaterialLayer('course-content/runtime/a.json')).toBe('generated-runtime-release');
    expect(classifyMaterialLayer('openspec/specs/a/spec.md')).toBe('active-openspec');
    expect(classifyMaterialLayer('openspec/changes/archive/2026-01-01-a/proposal.md')).toBe('archived-openspec');
    expect(classifyMaterialLayer('artifacts/qa/session.png')).toBe('binary-media-model');
    expect(classifyMaterialLayer('artifacts/qa/session.json')).toBe('qa-browser-evidence');
    expect(classifyMaterialLayer('.github/workflows/ci.yml')).toBe('build-assets');
    expect(classifyMaterialLayer('public/logo.png')).toBe('binary-media-model');

    const files = coreFixtureFiles();
    const result = generatePostConvergenceSuccessor(makeInput(files));
    qualifyPostConvergence(result.pack, result.failures);
    expect(result.pack.layerReconciliation).toEqual({
      trackedFileCount: files.length,
      layerAssignedCount: files.length,
      unassignedCount: 0,
    });
    const byLayer = new Map(result.pack.materialLayers.map((layer) => [layer.layer, layer]));
    expect(byLayer.get('tests')!.totals.represented).toBe(1);
    expect(byLayer.get('binary-media-model')!.totals.represented).toBe(6);
    expect(byLayer.get('archived-openspec')!.totals.represented).toBe(1);
    expect(byLayer.get('generated-runtime-release')!.totals.represented).toBeGreaterThanOrEqual(1);
    const representedSum = result.pack.materialLayers.reduce((sum, layer) => sum + layer.totals.represented, 0);
    expect(representedSum).toBe(files.length);
    for (const layer of result.pack.materialLayers) {
      expect(layer.totals.unresolved).toBe(0);
      expect(layer.totals.duplicate).toBe(0);
    }
  });

  it('derives all eleven denominator slices from the census core with reconciled totals', () => {
    const result = generatePostConvergenceSuccessor(makeInput(coreFixtureFiles()));
    qualifyPostConvergence(result.pack, result.failures);
    expect(result.pack.denominatorSlices.map((slice) => slice.slice).sort()).toEqual(
      [...result.pack.denominatorSlices.map((slice) => slice.slice)].sort(),
    );
    expect(result.pack.denominatorSlices).toHaveLength(11);
    const bySlice = new Map(result.pack.denominatorSlices.map((slice) => [slice.slice, slice]));
    expect(bySlice.get('feature-to-app-router')!.totals.represented).toBeGreaterThan(0);
    expect(bySlice.get('deep-import')!.totals.represented).toBeGreaterThan(0);
    expect(bySlice.get('core-infrastructure')!.totals.represented).toBeGreaterThan(0);
    expect(bySlice.get('src-lib-business')!.totals.represented).toBeGreaterThan(0);
    expect(bySlice.get('scc')!.totals.represented).toBeGreaterThan(0);
    expect(bySlice.get('compatibility')!.totals.represented).toBeGreaterThan(0);
    expect(bySlice.get('duplicate-owner')!.totals.represented).toBeGreaterThan(0);
    expect(bySlice.get('public-entrypoint')!.totals.represented).toBeGreaterThan(0);
    expect(bySlice.get('single-implementation-interface')!.totals.represented).toBeGreaterThan(0);
    expect(bySlice.get('delegate-only-wrapper')!.totals.represented).toBeGreaterThan(0);
    expect(bySlice.get('zero-caller')!.totals.represented).toBeGreaterThan(0);
    for (const slice of result.pack.denominatorSlices) {
      expect(slice.totals.unresolved).toBe(0);
      expect(slice.totals.duplicate).toBe(0);
      expect(slice.totals.discovered).toBeGreaterThanOrEqual(slice.totals.represented);
    }
    const sliceRecords = result.detail.find((artifact) => artifact.name === 'denominator-slices.ndjson')!;
    for (const slice of result.pack.denominatorSlices) {
      const representedIds = sliceRecords.content
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { slice: string; identity: string })
        .filter((record) => record.slice === slice.slice)
        .map((record) => record.identity);
      expect(new Set(representedIds).size).toBe(slice.totals.represented);
    }
  });

  it('keeps the successor kind set byte-equal to the predecessor manifest kind set and fails on drift', () => {
    const ok = generatePostConvergenceSuccessor(makeInput(coreFixtureFiles()));
    qualifyPostConvergence(ok.pack, ok.failures);
    expect(ok.pack.inventoryKindSet.join(',')).toBe(ok.pack.predecessorKindSet.join(','));
    expect(ok.pack.inventoryKindSet).toHaveLength(18);

    const drifted = makePredecessors([...INVENTORY_KINDS].slice(0, 17).sort());
    const bad = generatePostConvergenceSuccessor(makeInput(coreFixtureFiles(), { predecessors: drifted }));
    expect(bad.failures.map((failure) => failure.code)).toContain('kind-set-mismatch');
    expect(() => qualifyPostConvergence(bad.pack, bad.failures)).toThrow(/kind-set-mismatch/);
  });

  it('classifies every tracked blob (unique payloads included) without adjudicating authority', () => {
    expect(classifyBlobPayloadClass(['course-content/runtime/lessons/2-1/media/unique.png'])).toBe('current-runtime-referenced');
    expect(classifyBlobPayloadClass(['openspec/changes/archive/2026-01-01-a/media/x.png'])).toBe('archive-only');
    expect(classifyBlobPayloadClass(['course-content/authoring/lessons/2-2/media/x.png'])).toBe('authoring-only');
    expect(classifyBlobPayloadClass(['src/lib/x.ts'])).toBe('other-tracked');
    expect(classifyBlobPayloadClass([
      'course-content/runtime/lessons/1-1/media/intro.png',
      'openspec/changes/archive/2026-01-01-a/media/intro.png',
    ])).toBe('mixed-unresolved');

    const input = makeInput(coreFixtureFiles());
    const result = generatePostConvergenceSuccessor(input);
    qualifyPostConvergence(result.pack, result.failures);
    const payload = result.pack.payloadClassTotals;
    expect(payload.duplicateBlobCount).toBe(2);
    const byClass = new Map(payload.classes.map((entry) => [entry.className, entry]));
    expect(byClass.get('current-runtime-referenced')!.blobCount).toBe(3);
    expect(byClass.get('current-runtime-referenced')!.duplicateBlobCount).toBe(1);
    expect(byClass.get('current-runtime-referenced')!.pathCount).toBe(4);
    expect(byClass.get('archive-only')!.blobCount).toBe(2);
    expect(byClass.get('archive-only')!.duplicateBlobCount).toBe(1);
    expect(byClass.get('archive-only')!.pathCount).toBe(3);
    expect(byClass.get('authoring-only')!.blobCount).toBe(2);
    expect(byClass.get('authoring-only')!.duplicateBlobCount).toBe(0);
    expect(byClass.get('other-tracked')!.blobCount).toBeGreaterThan(0);
    const classifiedBlobTotal = payload.classes.reduce((sum, entry) => sum + entry.blobCount, 0);
    expect(classifiedBlobTotal).toBe(new Set(input.blobIndex.values()).size);
    expect(payload.classes.every((entry) => entry.pathCount >= entry.blobCount)).toBe(true);
    expect(result.files['payload-classes.md']).toContain('unique runtime/archive/authoring payloads included');
    expect(result.files['payload-classes.md']).toContain('nothing here authorizes deletion');
  });

  it('ranks the Top 50 hotspot vector deterministically and keeps missing inputs unresolved', () => {
    const files = [
      ...coreFixtureFiles(),
      file('src/features/big/big-file.ts', `${'export function f() { if (1) { for (let i = 0; i < 2; i++) { } } }\n'.repeat(40)}`),
      binary('src/features/opaque/binary-asset.ts', 4096),
    ];
    const input = makeInput(files);
    const result = generatePostConvergenceSuccessor(input);
    qualifyPostConvergence(result.pack, result.failures);
    expect(result.pack.hotspotTotals.ranked).toBeLessThanOrEqual(50);
    expect(result.pack.hotspotTotals.unresolvedMetrics).toBe(1);
    expect(result.files['hotspots.md']).toContain('src/features/big/big-file.ts');
    expect(result.files['hotspots.md']).toContain('metrics unresolved, not zero');
    expect(result.pack.artifacts.filter((artifact) => artifact.logicalLocator === 'hotspots.md')).toHaveLength(1);
  });

  it('projects owner residue from the delta predecessor plus census observations without adjudication', () => {
    const result = generatePostConvergenceSuccessor(makeInput(coreFixtureFiles()));
    qualifyPostConvergence(result.pack, result.failures);
    const residueDoc = result.files['owner-residue.md'];
    expect(residueDoc).toContain('current-head-delta:retirement:src/features/adaptive/legacy-ui.tsx');
    expect(residueDoc).toContain('census-duplicate-owner:src/lib/legacy-bridge.ts');
    expect(residueDoc).toContain('census-public-entrypoint:');
    expect(residueDoc).toContain('Ambiguity is retained');
    expect(residueDoc).toContain('src/app/page.tsx(production/import)');
    expect(residueDoc).toContain('zero-production-consumers');
    const residueDetail = result.detail.find((artifact) => artifact.name === 'owner-residue.ndjson')!;
    const detailRecords = residueDetail.content.split('\n').filter(Boolean).map(
      (line) => JSON.parse(line) as {
        id: string;
        consumers: Array<{ path: string; kind: string; relationship: string }>;
        deletionCondition: string;
        trustBoundary: string | null;
      },
    );
    const deltaRecord = detailRecords.find((row) => row.id === 'current-head-delta:retirement:src/features/adaptive/legacy-ui.tsx');
    expect(deltaRecord?.consumers).toEqual([{ path: 'src/app/page.tsx', kind: 'production', relationship: 'import' }]);
    expect(deltaRecord?.deletionCondition).toBe('zero-production-consumers');
    expect(deltaRecord?.trustBoundary).toBeNull();
    expect(result.pack.handoff.find((entry) => entry.consumer === 'B-owner-residue')!.locators)
      .toContain(result.detail.find((artifact) => artifact.name === 'owner-residue.ndjson')!.logicalLocator);
    const parsed = JSON.parse(result.files['baseline.json']) as { ownerResidueTotals: { total: number; unresolved: number; ambiguous: number } };
    expect(parsed.ownerResidueTotals.total).toBeGreaterThan(3);
    expect(parsed.ownerResidueTotals.unresolved).toBeGreaterThanOrEqual(1);
    expect(parsed.ownerResidueTotals.ambiguous).toBeGreaterThanOrEqual(1);
  });

  it('records bounded test observations through immutable receipts and freezes their ids', () => {
    const first = makeReceipt(identity.sourceCommit, '2026-09-03T01:00:00Z');
    const second = makeReceipt(identity.sourceCommit, '2026-09-03T02:00:00Z');
    expect(first.receiptId).not.toBe(second.receiptId);
    const result = generatePostConvergenceSuccessor(makeInput(coreFixtureFiles(), { receipts: [first, second] }));
    qualifyPostConvergence(result.pack, result.failures);
    expect(result.pack.frozenReceiptIds).toEqual([first.receiptId, second.receiptId].sort());
    expect(result.files['test-baseline.md']).toContain(first.receiptId);
    expect(result.files['test-baseline.md']).toContain('does not change test-command qualification');
    expect(result.detail.some((artifact) => artifact.name === `receipts/${first.receiptId}.json`)).toBe(true);
  });

  it('is byte-identical for identical inputs and changes identity when the source changes', () => {
    const input = makeInput(coreFixtureFiles());
    const first = generatePostConvergenceSuccessor(input);
    const second = generatePostConvergenceSuccessor(input);
    qualifyPostConvergence(first.pack, first.failures);
    expect(first.files).toEqual(second.files);
    expect(first.detail).toEqual(second.detail);
    expect(serializeDeterministic(first.pack)).toBe(serializeDeterministic(second.pack));

    const changed = makeInput([...coreFixtureFiles(), file('src/features/new-surface.ts', 'export const fresh = 1;\n')]);
    changed.blobIndex.set('src/features/new-surface.ts', sha256Text('src/features/new-surface.ts'));
    changed.gitBytes.set('src/features/new-surface.ts', 31);
    const third = generatePostConvergenceSuccessor(changed);
    qualifyPostConvergence(third.pack, third.failures);
    expect(third.pack.successorCaptureId).not.toBe(first.pack.successorCaptureId);
  });

  it('verifies artifact digests and fails closed on missing or drifted locators', () => {
    const result = generatePostConvergenceSuccessor(makeInput(coreFixtureFiles()));
    qualifyPostConvergence(result.pack, result.failures);
    expect(verifySuccessorArtifacts(result.pack, locatorReader(result))).toEqual([]);

    const reader = locatorReader(result);
    const missing = (locator: string): string => {
      if (locator === 'hotspots.md') throw new Error('missing');
      return reader(locator);
    };
    expect(verifySuccessorArtifacts(result.pack, missing).map((failure) => failure.code)).toContain('artifact-locator-missing');

    const drifted = (locator: string): string => `${reader(locator)}tampered`;
    expect(verifySuccessorArtifacts(result.pack, drifted).map((failure) => failure.code)).toContain('artifact-digest-mismatch');
  });

  it('rejects dirty, mixed, unresolved, and non-origin source identities before capture', () => {
    const snapshot = snapshotFromFiles(identity, coreFixtureFiles());
    expect(successorPreconditionFailures({
      originIntegrationCommit: identity.sourceCommit,
      headCommit: identity.sourceCommit,
      snapshot,
    })).toEqual([]);
    expect(successorPreconditionFailures({
      originIntegrationCommit: identity.sourceCommit,
      headCommit: 'f'.repeat(40),
      snapshot,
    }).map((failure) => failure.code)).toContain('origin-head-mismatch');
    expect(successorPreconditionFailures({
      originIntegrationCommit: identity.sourceCommit,
      headCommit: identity.sourceCommit,
      snapshot: { ...snapshot, dirty: true },
    }).map((failure) => failure.code)).toContain('dirty-worktree');
    expect(successorPreconditionFailures({
      originIntegrationCommit: identity.sourceCommit,
      headCommit: identity.sourceCommit,
      snapshot: { ...snapshot, mixedWorktree: true },
    }).map((failure) => failure.code)).toContain('mixed-worktree');
    expect(successorPreconditionFailures({
      originIntegrationCommit: identity.sourceCommit,
      headCommit: identity.sourceCommit,
      snapshot: { ...snapshot, detachedUnresolved: true },
    }).map((failure) => failure.code)).toContain('unresolved-identity');

    expect(successorWriteGate(identity, identity.sourceCommit, '', identity.sourceCommit, identity.sourceTree)).toEqual([]);
    expect(successorWriteGate(identity, 'f'.repeat(40), '', identity.sourceCommit, identity.sourceTree)
      .map((failure) => failure.code)).toContain('origin-head-mismatch');
    expect(successorWriteGate(identity, identity.sourceCommit, ' M file', identity.sourceCommit, identity.sourceTree)
      .map((failure) => failure.code)).toContain('dirty-worktree');
    expect(successorWriteGate(identity, identity.sourceCommit, '', 'f'.repeat(40), identity.sourceTree)
      .map((failure) => failure.code)).toContain('mixed-identity');
  });

  it('rejects drifted predecessors, receipts, blob identities, and privacy violations', () => {
    const mismatchedReceipt = makeReceipt('f'.repeat(40));
    const receiptFailure = generatePostConvergenceSuccessor(makeInput(coreFixtureFiles(), { receipts: [mismatchedReceipt] }));
    expect(receiptFailure.failures.map((failure) => failure.code)).toContain('receipt-identity-mismatch');
    expect(() => qualifyPostConvergence(receiptFailure.pack, receiptFailure.failures)).toThrow(/receipt-identity-mismatch/);

    const input = makeInput(coreFixtureFiles());
    input.blobIndex.delete('src/lib/shared-result.ts');
    const blobFailure = generatePostConvergenceSuccessor(input);
    expect(blobFailure.failures.map((failure) => failure.code)).toContain('missing-blob-identity');

    const privacyFailure = generatePostConvergenceSuccessor(
      makeInput([...coreFixtureFiles(), file('/Users/YW/secret.ts', 'export const value = 1;\n')]),
    );
    expect(privacyFailure.failures.map((failure) => failure.code)).toContain('absolute-path');
    expect(() => qualifyPostConvergence(privacyFailure.pack, privacyFailure.failures)).toThrow(/absolute-path/);

    const before = { baselineCensusSha256: 'a'.repeat(64), deltaSha256: 'b'.repeat(64) };
    expect(predecessorOverwriteFailures(before, before)).toEqual([]);
    expect(predecessorOverwriteFailures(before, { baselineCensusSha256: 'c'.repeat(64), deltaSha256: 'b'.repeat(64) })
      .map((failure) => failure.code)).toEqual(['historical-overwrite']);
  });

  it('rejects overwriting an existing successor package while allowing byte-identical reruns', () => {
    const files = { 'baseline.json': '{"a":1}\n', 'summary.md': '# s\n' };
    expect(successorOverwriteFailures(files, () => null)).toEqual([]);
    expect(successorOverwriteFailures(files, (name) => files[name] ?? null)).toEqual([]);
    expect(successorOverwriteFailures(files, () => { throw new Error('missing'); })).toEqual([]);
    expect(successorOverwriteFailures(files, (name) => (name === 'summary.md' ? '# different\n' : files[name] ?? null))
      .map((failure) => failure.code)).toEqual(['successor-overwrite']);
  });

  it('renders the full capture identity in every projection', () => {
    const result = generatePostConvergenceSuccessor(makeInput(coreFixtureFiles()));
    qualifyPostConvergence(result.pack, result.failures);
    const projections = [
      result.files['summary.md'],
      result.files['owner-residue.md'],
      result.files['hotspots.md'],
      result.files['payload-classes.md'],
      result.files['test-baseline.md'],
    ];
    for (const doc of projections) {
      expect(doc).toContain(result.pack.successorCaptureId);
      expect(doc).toContain(result.pack.captureIdentity.sourceCommit);
      expect(doc).toContain(result.pack.captureIdentity.sourceTree);
      expect(doc).toContain(result.pack.captureIdentity.commitTime);
      expect(doc).toContain(result.pack.predecessorBaseline.sourceCommit);
      expect(doc).toContain(result.pack.predecessorCurrentHead.sourceCommit);
      expect(doc).toContain(result.pack.schemaVersions.censusCore);
      expect(doc).toContain(result.pack.schemaVersions.measurementReceipt);
      expect(doc).toContain(result.pack.schemaVersions.currentHeadDelta);
      for (const receiptId of result.pack.frozenReceiptIds) {
        expect(doc).toContain(receiptId);
      }
      expect(doc).not.toContain(result.pack.packageDigest);
    }
    const empty = generatePostConvergenceSuccessor(makeInput(coreFixtureFiles(), { receipts: [] }));
    qualifyPostConvergence(empty.pack, empty.failures);
    for (const doc of [empty.files['summary.md'], empty.files['hotspots.md']]) {
      expect(doc).toContain('frozenReceiptIds: _none_');
    }
  });

  it('keeps qualification observational and tamper-evident: no active-baseline, digest covers the envelope', () => {
    const result = generatePostConvergenceSuccessor(makeInput(coreFixtureFiles()));
    qualifyPostConvergence(result.pack, result.failures);
    expect(result.pack.status).toBe('qualified-for-investigation');
    expect(result.pack.statusEvidence.map((stage) => stage.stage)).toEqual([
      'captured',
      'digest-verified',
      'qualified-for-investigation',
    ]);
    expect(result.files['baseline.json']).toContain('"status":"qualified-for-investigation"');
    expect(result.files['summary.md']).toContain('never becomes the active baseline');
    expect(result.pack.handoff.map((entry) => entry.consumer)).toEqual([
      'B-owner-residue',
      'C-payload-classes',
      'D-test-baseline',
      'N5-activation',
    ]);
    for (const entry of result.pack.handoff) {
      expect(entry.requiredIdentity).toBe(result.pack.successorCaptureId);
    }

    const tamperedStatus = { ...result.pack, status: 'active-baseline' as unknown as typeof result.pack.status };
    expect(() => qualifyPostConvergence(tamperedStatus, [])).toThrow(/unsupported-status|package-digest-mismatch/);
    expect(successorPackageDigest(tamperedStatus)).not.toBe(result.pack.packageDigest);
    const tamperedOrigin = { ...result.pack, originIntegrationCommit: 'f'.repeat(40) };
    expect(successorPackageDigest(tamperedOrigin)).not.toBe(result.pack.packageDigest);
    const tamperedArtifactRow = {
      ...result.pack,
      artifacts: result.pack.artifacts.map((artifact) => (
        artifact.logicalLocator === 'hotspots.md' ? { ...artifact, sha256: '0'.repeat(64) } : artifact
      )),
    };
    expect(successorPackageDigest(tamperedArtifactRow)).not.toBe(result.pack.packageDigest);
    const tamperedDetailRow = {
      ...result.pack,
      artifacts: result.pack.artifacts.map((artifact) => (
        artifact.logicalLocator.endsWith('full-inventory.ndjson')
          ? { ...artifact, byteCount: artifact.byteCount + 1 }
          : artifact
      )),
    };
    expect(successorPackageDigest(tamperedDetailRow)).not.toBe(result.pack.packageDigest);
    const tamperedHandoff = {
      ...result.pack,
      handoff: result.pack.handoff.map((entry) => (
        entry.consumer === 'N5-activation' ? { ...entry, failClosedRule: `${entry.failClosedRule}x` } : entry
      )),
    };
    expect(successorPackageDigest(tamperedHandoff)).not.toBe(result.pack.packageDigest);
    const tamperedSummaryRow = {
      ...result.pack,
      artifacts: result.pack.artifacts.map((artifact) => (
        artifact.logicalLocator === 'summary.md' ? { ...artifact, sha256: sha256Text('forged summary') } : artifact
      )),
    };
    expect(successorPackageDigest(tamperedSummaryRow)).not.toBe(result.pack.packageDigest);
    expect(result.files['summary.md']).not.toContain(result.pack.packageDigest);
  });

  it('derives byte counts from Git objects, counting symlink blobs and zeroing gitlinks', () => {
    const files = [
      ...coreFixtureFiles(),
      { path: 'evaluate/test_repos/express', content: '', byteLength: 4096 },
      { path: '.claude/skills/demo-link', content: '', byteLength: 64 },
      file('src/lib/stat-vs-git.ts', 'export const x = 1;\n'),
    ];
    const input = makeInput(files);
    input.gitBytes.set('evaluate/test_repos/express', 0);
    input.gitBytes.set('.claude/skills/demo-link', 11);
    input.gitBytes.set('src/lib/stat-vs-git.ts', 21);
    const result = generatePostConvergenceSuccessor(input);
    qualifyPostConvergence(result.pack, result.failures);
    const inventoryRecord = (path: string) => result.detail
      .find((artifact) => artifact.name === 'full-inventory.ndjson')!
      .content.split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { path: string; byteCount: number })
      .find((record) => record.path === path);
    expect(inventoryRecord('evaluate/test_repos/express')?.byteCount).toBe(0);
    expect(inventoryRecord('.claude/skills/demo-link')?.byteCount).toBe(11);
    expect(inventoryRecord('src/lib/stat-vs-git.ts')?.byteCount).toBe(21);

    input.gitBytes.delete('src/lib/stat-vs-git.ts');
    const missing = generatePostConvergenceSuccessor(input);
    expect(missing.failures.map((failure) => failure.code)).toContain('missing-git-byte-identity');
  });

  it('matches test density through the .test/.spec suffix', () => {
    const files = [
      ...coreFixtureFiles(),
      file('src/lib/konling-agent-runtime.ts', 'export const runtime = 1;\n'),
      file('src/lib/__tests__/konling-agent-runtime.test.ts', 'import { runtime } from "@/lib/konling-agent-runtime";\ntest("runtime", () => { expect(runtime).toBe(1); });\n'),
      file('src/lib/other-place/konling-agent-runtime.spec.ts', 'test("runtime again", () => { expect(true).toBe(true); });\n'),
    ];
    const input = makeInput(files);
    const result = generatePostConvergenceSuccessor(input);
    qualifyPostConvergence(result.pack, result.failures);
    const cellsOf = (path: string) => result.files['hotspots.md']
      .split('\n')
      .find((line) => line.includes(path))!
      .split('|')
      .map((cellText) => cellText.trim());
    const konling = cellsOf('src/lib/konling-agent-runtime.ts');
    expect(konling[konling.length - 4]).toBe('2');
    const orphan = cellsOf('src/lib/orphan/orphan.ts');
    expect(orphan[orphan.length - 4]).toBe('1');
  });

  it('loads the real predecessor baseline and current-head delta with matching kind lineage', () => {
    const repoRoot = process.cwd();
    if (!existsSync(join(repoRoot, 'docs/architecture/modular-monolith/baseline/census-core.json'))) return;
    const predecessors = loadSuccessorPredecessors(repoRoot);
    expect(predecessors.predecessorKindSet.sort().join(',')).toBe([...INVENTORY_KINDS].sort().join(','));
    expect(predecessors.currentHead.schemaVersion).toBe(CURRENT_HEAD_DELTA_SCHEMA_VERSION);
    expect(predecessors.currentHead.packageSha256).toMatch(/^[a-f0-9]{64}$/u);
  });
});
