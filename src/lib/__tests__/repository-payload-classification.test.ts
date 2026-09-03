import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  A_ISSUE,
  PAYLOAD_CLASSIFICATION_SCHEMA_VERSION,
  PAYLOAD_SLICES,
  assignPayloadSlice,
  classifyPackage,
  computePackageDigest,
  loadCommittedAHandoff,
  parseAHandoff,
  scanClassificationText,
  selectPrimaryClass,
  type AHandoff,
  type ClassifyInput,
  type EvidenceOverride,
  type Facets,
  type InventoryEntry,
  type IssueGate,
  type ToolCheckpoint,
} from '@/lib/architecture-census/payload-classification';
import type { PostConvergenceEnvelope } from '@/lib/architecture-census/types';

const gate: IssueGate = {
  issue: A_ISSUE,
  closed: true,
  archived: true,
  blockedByOpen: false,
  evidence: 'fixture',
};

const tool: ToolCheckpoint = {
  toolCommit: '1'.repeat(40),
  toolTree: '2'.repeat(40),
  schemaVersion: PAYLOAD_CLASSIFICATION_SCHEMA_VERSION,
  entryBundleDigest: '3'.repeat(64),
};

function handoff(count = 1): AHandoff {
  return {
    successorCaptureId: 'a'.repeat(64),
    packageDigest: 'b'.repeat(64),
    sourceCommit: 'c'.repeat(40),
    sourceTree: 'd'.repeat(40),
    schemaVersion: 'act-architecture-post-convergence-successor/v1',
    fullInventoryLocator: 'artifacts/architecture-census/aa/full-inventory.ndjson',
    fullInventorySha256: 'e'.repeat(64),
    trackedFileCount: count,
  };
}

function entry(path: string, hash = 'f'.repeat(40), sizeBytes = 10): InventoryEntry {
  return { path, hash, sizeBytes };
}

function completeFacets(overrides: Partial<Facets> = {}): Facets {
  return {
    authorship: 'hand-authored',
    reproducibility: 'not-applicable',
    releaseRoles: [],
    qaRoles: [],
    cacheMaterializedRoles: [],
    privacy: 'internal',
    retention: 'retain-in-git',
    ...overrides,
  };
}

function completeOverride(path: string, facets: Partial<Facets> = {}): EvidenceOverride {
  return {
    path,
    facets: completeFacets(facets),
    producer: `producer:${path}`,
    consumers: ['documentation:path-read'],
    authority: 'canonical-source:fixture',
    materialization: 'not-applicable',
    recovery: 'git-checkout-source-tree',
    rollback: 'git-history-blob',
  };
}

function input(partial: Partial<ClassifyInput> & Pick<ClassifyInput, 'entries'>): ClassifyInput {
  return {
    issueGate: gate,
    handoff: handoff(partial.entries.length),
    tool,
    ...partial,
  };
}

describe('repository payload classification', () => {
  it('blocks claim/classify when the A issue gate is incomplete', () => {
    const result = classifyPackage(input({
      issueGate: { ...gate, closed: false, evidence: 'open' },
      entries: [entry('src/lib/a.ts')],
    }));
    expect(result.status).toBe('blocked');
    expect(result.reason).toBe('a-issue-gate-incomplete');
    expect(result.files).toBeNull();
    expect(result.members).toEqual([]);
  });

  it('blocks missing, mismatched, and locally substituted A handoffs', () => {
    expect(classifyPackage(input({ handoff: null, entries: [entry('src/lib/a.ts')] })).reason).toBe('a-handoff-missing');
    expect(classifyPackage(input({
      entries: [entry('src/lib/a.ts')],
      expectedIdentities: { successorCaptureId: '9'.repeat(64) },
    })).reason).toBe('a-subject-identity-drift');
    expect(classifyPackage(input({
      entries: [entry('src/lib/a.ts')],
      expectedIdentities: { packageDigest: '8'.repeat(64) },
    })).reason).toBe('a-capture-digest-drift');
    expect(classifyPackage(input({
      entries: [entry('src/lib/a.ts')],
      expectedIdentities: { toolCommit: '7'.repeat(40) },
    })).reason).toBe('tool-identity-drift');
  });

  it('closes the required slices without proposal-time hardcoded counts', () => {
    const entries = [
      entry('course-content/runtime/releases/v1/manifest.json'),
      entry('course-content/runtime/lessons/1-1/a.md'),
      entry('artifacts/qa/session.json'),
      entry('docs/architecture/modular-monolith/baseline.json'),
      entry('openspec/changes/archive/2026-01-01-x/evidence/log.json'),
      entry('rust/control-engine/pkg/engine.wasm'),
      entry('src/lib/__fixtures__/snapshot.json'),
      entry('course-content/authoring/lessons/1-1/infograph/node.png'),
      entry('docs/slides/deck.pptx'),
      entry('docs/plots/plot.ppm'),
      entry('docs/plots/plot.emf'),
      entry('src/resources/model.glb'),
      entry('src/lib/data.json'),
      entry('src/lib/a.ts'),
    ];
    const result = classifyPackage(input({ entries }));
    expect(result.status).toBe('qualified');
    expect(result.slices.map((slice) => slice.slice)).toEqual([...PAYLOAD_SLICES]);
    expect(result.slices.reduce((sum, slice) => sum + slice.discovered, 0)).toBe(entries.length);
    expect(result.files?.['summary.md']).not.toMatch(/5\.97|1\.19/);
    expect(assignPayloadSlice('course-content/runtime/releases/v1/manifest.json')).toBe('course-content-releases');
  });

  it('keeps generated inputs outside the tracked denominator', () => {
    const result = classifyPackage(input({
      entries: [entry('src/lib/a.ts')],
      generatedInputs: [{
        path: '.next/cache/x',
        producer: 'next-build',
        className: 'generated',
        digest: '4'.repeat(64),
        sourceIdentity: 'a'.repeat(64),
      }],
    }));
    expect(result.status).toBe('qualified');
    expect(result.members.map((member) => member.path)).toEqual(['src/lib/a.ts']);
    expect(result.generatedInputs).toHaveLength(1);
    expect(classifyPackage(input({
      entries: [entry('.next/cache/x')],
      generatedInputs: [{
        path: '.next/cache/x',
        producer: 'next-build',
        className: 'generated',
        digest: '4'.repeat(64),
        sourceIdentity: 'a'.repeat(64),
      }],
    })).reason).toContain('generated-input-in-denominator');
  });

  it('assigns D+F→F, B+C→C, B+E→E, A+F→F and keeps non-primary facets', () => {
    expect(selectPrimaryClass(completeFacets({
      qaRoles: ['run-specific-output'],
      privacy: 'regulated',
    }))).toBe('F');
    expect(selectPrimaryClass(completeFacets({
      authorship: 'generated',
      reproducibility: 'reproducible',
      releaseRoles: ['immutable-release'],
    }))).toBe('C');
    expect(selectPrimaryClass(completeFacets({
      authorship: 'generated',
      reproducibility: 'reproducible',
      cacheMaterializedRoles: ['materialized-view'],
    }))).toBe('E');
    expect(selectPrimaryClass(completeFacets({
      authorship: 'hand-authored',
      privacy: 'regulated',
    }))).toBe('F');

    const result = classifyPackage(input({
      entries: [
        entry('artifacts/qa/private.json'),
        entry('course-content/runtime/releases/v1/blob.bin'),
        entry('course-content/runtime/cache/view.json'),
        entry('src/lib/secret-source.ts'),
      ],
      overrides: [
        completeOverride('artifacts/qa/private.json', {
          authorship: 'generated',
          reproducibility: 'reproducible',
          qaRoles: ['run-specific-output'],
          privacy: 'regulated',
          retention: 'existing-external-lifecycle',
        }),
        completeOverride('course-content/runtime/releases/v1/blob.bin', {
          authorship: 'generated',
          reproducibility: 'reproducible',
          releaseRoles: ['immutable-release'],
        }),
        completeOverride('course-content/runtime/cache/view.json', {
          authorship: 'generated',
          reproducibility: 'reproducible',
          cacheMaterializedRoles: ['materialized-view'],
        }),
        completeOverride('src/lib/secret-source.ts', {
          authorship: 'hand-authored',
          privacy: 'regulated',
        }),
      ],
    }));
    const byPath = new Map(result.members.map((member) => [member.path, member]));
    expect(byPath.get('artifacts/qa/private.json')?.primaryClass).toBe('F');
    expect(byPath.get('artifacts/qa/private.json')?.facets.qaRoles).toContain('run-specific-output');
    expect(byPath.get('course-content/runtime/releases/v1/blob.bin')?.primaryClass).toBe('C');
    expect(byPath.get('course-content/runtime/releases/v1/blob.bin')?.facets.authorship).toBe('generated');
    expect(byPath.get('course-content/runtime/cache/view.json')?.primaryClass).toBe('E');
    expect(byPath.get('src/lib/secret-source.ts')?.primaryClass).toBe('F');
    expect(byPath.get('src/lib/secret-source.ts')?.facets.authorship).toBe('hand-authored');
  });

  it('keeps unknown privacy unresolved with null primary class', () => {
    const result = classifyPackage(input({
      entries: [entry('artifacts/qa/session.json')],
    }));
    expect(result.members[0]?.memberDisposition).toBe('unresolved');
    expect(result.members[0]?.primaryClass).toBeNull();
    expect(result.members[0]?.unresolvedReason).toBe('unknown-privacy');
    expect(result.members[0]?.path.startsWith('redacted:')).toBe(true);
    expect(result.members[0]?.recordId.startsWith('member:')).toBe(true);
    expect(result.members[0]?.recordId).not.toContain('artifacts/qa');
    expect(result.files?.['index.json']).not.toMatch(/"primaryClass":"G"/);
  });

  it('treats exact duplicates as observations and preserves near-duplicate algorithm evidence', () => {
    const hash = 'ab'.repeat(20);
    const result = classifyPackage(input({
      entries: [entry('src/lib/a.ts', hash, 12), entry('src/lib/copy.ts', hash, 12)],
      nearDuplicateGroups: [{
        kind: 'near',
        algorithm: 'a-frozen-compare',
        parameters: 'window=0',
        memberIds: ['member:src/lib/a.ts', 'member:src/lib/copy.ts'],
      }],
    }));
    expect(result.duplicateGroups.some((group) => group.kind === 'exact' && group.memberIds.length === 2)).toBe(true);
    expect(result.members).toHaveLength(2);
    expect(result.members.every((member) => member.memberDisposition !== undefined)).toBe(true);
    const near = result.duplicateGroups.find((group) => group.kind === 'near');
    expect(near?.algorithm).toBe('a-frozen-compare');
    expect(result.slices.find((slice) => slice.slice === 'other-captured')?.discovered).toBe(2);
  });

  it('keeps future eligibility unresolved unless every independent gate is proved', () => {
    const missing = classifyPackage(input({ entries: [entry('src/lib/a.ts')] }));
    expect(missing.members[0]?.futureEligible).toBe('unresolved');
    const ready = classifyPackage(input({
      entries: [entry('docs/architecture/note.md')],
      overrides: [{
        ...completeOverride('docs/architecture/note.md'),
        consumers: ['documentation:path-read'],
        authority: 'canonical-source:docs',
      }],
    }));
    expect(ready.members[0]?.futureEligible).toBe(true);
    expect(ready.members[0]?.primaryClass).toBe('A');
  });

  it('fails closed on forbidden injections without copying the injected text into a qualified package', () => {
    const surfaces = ['summary.md', 'policy-matrix.md', 'unresolved.md', 'future-eligibility.md', 'inventory-header', 'member', 'evidence-locator'] as const;
    for (const surface of surfaces) {
      const result = classifyPackage(input({
        entries: [entry('src/lib/a.ts')],
        injectForbidden: { [surface]: 'postgres://user:secret@localhost/db' },
      }));
      expect(result.status).toBe('package-unqualified');
      expect(result.reason).toMatch(/^privacy:/);
      expect(result.files).toBeNull();
      expect(JSON.stringify(result.privacyViolations)).not.toContain('postgres://user:secret');
    }
  });

  it('rejects a self-hashed index and is byte-identical across equivalent runs', () => {
    const first = classifyPackage(input({ entries: [entry('src/lib/a.ts')] }));
    const second = classifyPackage(input({ entries: [entry('src/lib/a.ts')] }));
    expect(first.status).toBe('qualified');
    expect(first.files?.['index.json']).toBe(second.files?.['index.json']);
    expect(first.packageDigest).toBe(second.packageDigest);
    const index = JSON.parse(first.files!['index.json']) as {
      projections: { logicalLocator: string }[];
      packageDigest: string;
    };
    expect(index.projections.map((item) => item.logicalLocator).sort()).toEqual([
      'future-eligibility.md',
      'policy-matrix.md',
      'summary.md',
      'unresolved.md',
    ]);
    expect(index.projections.some((item) => item.logicalLocator === 'index.json')).toBe(false);
    expect(first.files!['index.json']).not.toMatch(/"logicalLocator":"index.json"/);
    const self = classifyPackage(input({
      entries: [entry('src/lib/a.ts')],
      includeIndexInDigest: true,
    }));
    expect(self.status).toBe('package-unqualified');
    expect(self.reason).toBe('self-referential-index-digest');
    expect(self.packageDigest).not.toBe(first.packageDigest);
    expect(computePackageDigest(
      input({ entries: [entry('src/lib/a.ts')] }),
      first.handoff!,
      first.members,
      first.frozenInputDigest,
    )).toBe(first.packageDigest);
  });

  it('rejects mutation attempts and leaves subject bytes unchanged', () => {
    const subject = '{"ok":true}';
    expect(() => classifyPackage(input({
      entries: [entry('src/lib/a.ts')],
      mutationRequest: 'deletion',
      subjectSourceBytes: subject,
    }))).toThrow(/read-only-boundary:deletion/);
    const result = classifyPackage(input({
      entries: [entry('src/lib/a.ts')],
      subjectSourceBytes: subject,
    }));
    expect(result.subjectSourceBytesAfter).toBe(subject);
  });

  it('parses the committed A envelope without rewriting it', () => {
    const raw = readFileSync(join(process.cwd(), 'docs/architecture/modular-monolith/post-convergence/baseline.json'), 'utf8');
    const envelope = JSON.parse(raw) as PostConvergenceEnvelope;
    const parsed = parseAHandoff(envelope);
    const loaded = loadCommittedAHandoff(process.cwd());
    expect(parsed.successorCaptureId).toBe(envelope.successorCaptureId);
    expect(parsed.packageDigest).toBe(envelope.packageDigest);
    expect(loaded.fullInventoryLocator).toContain('full-inventory.ndjson');
    expect(loaded.trackedFileCount).toBe(78494);
    expect(scanClassificationText('/Users/YW/secret')).toBe('absolute-path');
  });
});
