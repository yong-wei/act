import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
  loadCommittedPredecessorPackage,
  parseAHandoff,
  scanClassificationText,
  selectPrimaryClass,
  subjectIdentityOf,
  verifyInventoryArtifact,
  type AHandoff,
  type ClassifyInput,
  type ClassifyResult,
  type CurrentSubject,
  type EvidenceOverride,
  type Facets,
  type InventoryEntry,
  type InventoryVerificationReceipt,
  type IssueGate,
  type ToolCheckpoint,
} from '@/lib/architecture-census/payload-classification';
import {
  buildContentCompilerAdapter,
  buildPrivacyScanAdapter,
  buildQaEvidenceAdapter,
  buildReleaseAdapter,
  isPrivacyScanCandidate,
  type QaLifecycleOutcome,
  type SubjectTreeReader,
} from '@/lib/architecture-census/payload-classification-adapters';
import { sha256Text } from '@/lib/architecture-census/serialize';
import type { PostConvergenceEnvelope } from '@/lib/architecture-census/types';

const gate: IssueGate = {
  issue: A_ISSUE,
  closed: true,
  archived: true,
  blockedByOpen: false,
  evidence: 'fixture',
};

const predecessorGate: IssueGate = { ...gate, issue: 1881 };

const tool: ToolCheckpoint = {
  toolCommit: '1'.repeat(40),
  toolTree: '2'.repeat(40),
  schemaVersion: PAYLOAD_CLASSIFICATION_SCHEMA_VERSION,
  entryBundleDigest: '3'.repeat(64),
};

const subject: CurrentSubject = {
  baseBranch: 'origin/integration',
  subjectCommit: 'f'.repeat(40),
  subjectTree: 'e'.repeat(40),
};

function predecessorFixture(trackedFileCount = 1) {
  return {
    changeId: 'classify-repository-payload-authority-and-materialization',
    issue: 1881,
    subjectIdentity: 'a'.repeat(64),
    packageDigest: 'd'.repeat(64),
    sourceCommit: 'c'.repeat(40),
    sourceTree: 'b'.repeat(40),
    trackedFileCount,
  };
}

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

function entry(path: string, hash = 'f0'.repeat(20), sizeBytes = 10): InventoryEntry {
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
    predecessorIssueGate: predecessorGate,
    handoff: handoff(partial.entries.length),
    subject,
    predecessor: predecessorFixture(partial.entries.length),
    predecessorPaths: partial.entries.map((item) => item.path),
    tool,
    ...partial,
  };
}

function verificationReceiptFor(result: ClassifyResult): InventoryVerificationReceipt {
  if (!result.files) throw new Error('no files');
  return {
    locator: `artifacts/architecture-census/${result.subjectIdentity}/payload-classification-inventory.ndjson`,
    byteCount: Buffer.byteLength(result.files.inventoryNdjson),
    sha256: sha256Text(result.files.inventoryNdjson),
    memberDenominator: result.members.length,
    subjectIdentity: result.subjectIdentity,
    toolCommit: result.tool.toolCommit,
    projectionsReconciled: true,
  };
}

/** Runs classification, derives a valid inventory verification receipt, then produces the final package. */
function runWithVerification(partial: Partial<ClassifyInput> & Pick<ClassifyInput, 'entries'>): ClassifyResult {
  const first = classifyPackage(input(partial));
  expect(first.files).not.toBeNull();
  return classifyPackage(input({ ...partial, inventoryVerification: verificationReceiptFor(first) }));
}

describe('repository payload classification', () => {
  it('blocks claim/classify when the A or predecessor issue gate is incomplete', () => {
    const result = classifyPackage(input({
      issueGate: { ...gate, closed: false, evidence: 'open' },
      entries: [entry('src/lib/a.ts')],
    }));
    expect(result.status).toBe('blocked');
    expect(result.reason).toBe('a-issue-gate-incomplete');
    expect(result.files).toBeNull();
    expect(result.members).toEqual([]);
    expect(classifyPackage(input({
      predecessorIssueGate: { ...predecessorGate, archived: false },
      entries: [entry('src/lib/a.ts')],
    })).reason).toBe('predecessor-issue-gate-incomplete');
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

  it('blocks incomplete current-subject and predecessor identities before any member is classified', () => {
    const base = { entries: [entry('src/lib/a.ts')] };
    expect(classifyPackage(input({ ...base, predecessor: null })).reason).toBe('predecessor-package-missing');
    expect(classifyPackage(input({
      ...base,
      predecessor: { ...predecessorFixture(), packageDigest: '' },
    })).reason).toBe('predecessor-identity-incomplete');
    expect(classifyPackage(input({
      ...base,
      subject: { ...subject, subjectCommit: 'short' },
    })).reason).toBe('current-subject-identity-incomplete');
    expect(classifyPackage(input({
      ...base,
      subject: { ...subject, subjectCommit: tool.toolCommit },
    })).reason).toBe('subject-is-implementation-commit');
    expect(classifyPackage(input({ ...base, predecessorPaths: null })).reason).toBe('predecessor-inventory-missing');
    expect(classifyPackage(input({ ...base, predecessorPaths: [] })).reason).toBe('predecessor-denominator-mismatch:0!=1');
    expect(classifyPackage(input({
      ...base,
      expectedIdentities: { subjectCommit: '9'.repeat(40) },
    })).reason).toBe('current-subject-commit-drift');
    expect(classifyPackage(input({
      ...base,
      expectedIdentities: { predecessorPackageDigest: '8'.repeat(64) },
    })).reason).toBe('predecessor-package-digest-drift');
  });

  it('binds the new subject identity and records the predecessor-to-current delta', () => {
    const entries = [entry('src/lib/a.ts'), entry('src/lib/new-payload.json')];
    const result = runWithVerification({
      entries,
      predecessorPaths: ['src/lib/a.ts', 'src/lib/gone.ts'],
      predecessor: predecessorFixture(2),
      overrides: entries.map((item) => completeOverride(item.path)),
    });
    expect(result.status).toBe('qualified');
    expect(result.subjectIdentity).toBe(subjectIdentityOf(subject));
    expect(result.members.every((member) => member.subjectIdentity === subjectIdentityOf(subject))).toBe(true);
    expect(result.delta).toEqual({
      predecessorTrackedCount: 2,
      currentTrackedCount: 2,
      addedCount: 1,
      removedCount: 1,
      unchangedCount: 1,
      addedSample: ['src/lib/new-payload.json'],
    });
    const index = JSON.parse(result.files!['index.json']) as {
      currentSubject: { subjectCommit: string };
      predecessor: { packageDigest: string };
      subjectIdentity: string;
    };
    expect(index.currentSubject.subjectCommit).toBe(subject.subjectCommit);
    expect(index.predecessor.packageDigest).toBe('d'.repeat(64));
    expect(index.subjectIdentity).toBe(subjectIdentityOf(subject));
  });

  it('recovers redacted predecessor paths so the delta counts real additions', () => {
    const currentPath = 'src/features/arena/student/rules.ts';
    const redactedKey = `redacted:${sha256Text(currentPath).slice(0, 16)}`;
    const result = runWithVerification({
      entries: [entry(currentPath), entry('docs/new.md')],
      predecessorPaths: [redactedKey, 'docs/old.md'],
      predecessor: predecessorFixture(2),
      overrides: [completeOverride(currentPath), completeOverride('docs/new.md')],
    });
    expect(result.delta?.addedCount).toBe(1);
    expect(result.delta?.addedSample).toEqual(['docs/new.md']);
    expect(result.delta?.removedCount).toBe(1);
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
    expect(result.status).toBe('package-unqualified');
    expect(result.reason).toMatch(/^unresolved-members:\d+:/);
    expect(result.reason).toContain('unknown-privacy');
    expect(result.slices.map((slice) => slice.slice)).toEqual([...PAYLOAD_SLICES]);
    expect(result.slices.reduce((sum, slice) => sum + slice.discovered, 0)).toBe(entries.length);
    expect(result.files?.['summary.md']).not.toMatch(/5\.97|1\.19/);
    expect(assignPayloadSlice('course-content/runtime/releases/v1/manifest.json')).toBe('course-content-releases');
  });

  it('keeps generated inputs outside the tracked denominator', () => {
    const result = runWithVerification({
      entries: [entry('src/lib/a.ts')],
      generatedInputs: [{
        path: '.next/cache/x',
        producer: 'next-build',
        className: 'generated',
        digest: '4'.repeat(64),
        sourceIdentity: 'a'.repeat(64),
      }],
    });
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

    const result = runWithVerification({
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
    });
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
    expect(result.status).toBe('package-unqualified');
    expect(result.reason).toBe('unresolved-members:1:unknown-privacy');
    expect(result.members[0]?.memberDisposition).toBe('unresolved');
    expect(result.members[0]?.primaryClass).toBeNull();
    expect(result.members[0]?.unresolvedReason).toBe('unknown-privacy');
    expect(result.members[0]?.path.startsWith('redacted:')).toBe(true);
    expect(result.members[0]?.recordId.startsWith('member:')).toBe(true);
    expect(result.members[0]?.recordId).not.toContain('artifacts/qa');
    expect(result.files?.['index.json']).not.toMatch(/"primaryClass":"G"/);
  });

  it('requires every completion gate: all-or-unqualified', () => {
    const ok = runWithVerification({ entries: [entry('src/lib/a.ts')] });
    expect(ok.status).toBe('qualified');
    expect(ok.reason).toBeNull();

    const unresolved = classifyPackage(input({ entries: [entry('artifacts/qa/session.json')] }));
    expect(unresolved.status).toBe('package-unqualified');
    expect(unresolved.reason).toBe('unresolved-members:1:unknown-privacy');

    const noVerification = classifyPackage(input({ entries: [entry('src/lib/a.ts')], inventoryVerification: null }));
    expect(noVerification.status).toBe('package-unqualified');
    expect(noVerification.reason).toBe('inventory-bytes-unverified');

    const first = classifyPackage(input({ entries: [entry('src/lib/a.ts')] }));
    const badReceipt = classifyPackage(input({
      entries: [entry('src/lib/a.ts')],
      inventoryVerification: { ...verificationReceiptFor(first), sha256: '0'.repeat(64) },
    }));
    expect(badReceipt.status).toBe('package-unqualified');
    expect(badReceipt.reason).toBe('inventory-bytes-unverified');

    const compatibility = classifyPackage(input({
      entries: [entry('src/lib/a.ts')],
      inventoryVerification: verificationReceiptFor(first),
      compatibilityChecks: [{ name: 'qa-evidence-lifecycle', status: 'unresolved', detail: 'dirty-worktree' }],
    }));
    expect(compatibility.status).toBe('package-unqualified');
    expect(compatibility.reason).toBe('compatibility:qa-evidence-lifecycle');

    const adapterDrift = classifyPackage(input({
      entries: [entry('src/lib/a.ts')],
      inventoryVerification: verificationReceiptFor(first),
      adapterIdentities: [{
        name: 'content-compiler-toolchain',
        inputDigest: '1'.repeat(64),
        candidates: 5,
        proven: 0,
        unresolved: 5,
        drift: 'toolchain-count-drift:40!=41',
      }],
    }));
    expect(adapterDrift.status).toBe('package-unqualified');
    expect(adapterDrift.reason).toBe('adapter-drift:toolchain-count-drift:40!=41');
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
    const ready = runWithVerification({
      entries: [entry('docs/architecture/note.md')],
      overrides: [{
        ...completeOverride('docs/architecture/note.md'),
        consumers: ['documentation:path-read'],
        authority: 'canonical-source:docs',
      }],
    });
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
    const first = runWithVerification({ entries: [entry('src/lib/a.ts')] });
    const receipt = verificationReceiptFor(first);
    const second = classifyPackage(input({ entries: [entry('src/lib/a.ts')], inventoryVerification: receipt }));
    expect(first.status).toBe('qualified');
    expect(first.files?.['index.json']).toBe(second.files?.['index.json']);
    expect(first.packageDigest).toBe(second.packageDigest);
    const third = runWithVerification({ entries: [entry('src/lib/a.ts')] });
    expect(third.files?.['index.json']).toBe(first.files?.['index.json']);
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
    const subjectBytes = '{"ok":true}';
    expect(() => classifyPackage(input({
      entries: [entry('src/lib/a.ts')],
      mutationRequest: 'deletion',
      subjectSourceBytes: subjectBytes,
    }))).toThrow(/read-only-boundary:deletion/);
    const result = classifyPackage(input({
      entries: [entry('src/lib/a.ts')],
      subjectSourceBytes: subjectBytes,
    }));
    expect(result.subjectSourceBytesAfter).toBe(subjectBytes);
  });

  it('does not invent candidate authority from a releases path and changes digest when evidence changes', () => {
    const release = classifyPackage(input({
      entries: [entry('course-content/runtime/releases/v1/manifest.json')],
    }));
    expect(release.members[0]?.authority).toBe('');
    expect(release.members[0]?.memberDisposition).toBe('unresolved');
    expect(release.members[0]?.unresolvedReason).toBe('missing-authority-manifest');

    const base = input({ entries: [entry('src/lib/a.ts')] });
    const first = classifyPackage(base);
    const second = classifyPackage({
      ...base,
      overrides: [completeOverride('src/lib/a.ts', { privacy: 'internal', authorship: 'generated', reproducibility: 'reproducible' })],
    });
    expect(first.packageDigest).not.toBe(second.packageDigest);
    expect(first.frozenInputDigest).not.toBe(second.frozenInputDigest);

    const withGenerated = classifyPackage({
      ...base,
      generatedInputs: [{
        path: '.next/cache/x',
        producer: 'next-build',
        className: 'generated',
        digest: '4'.repeat(64),
        sourceIdentity: 'a'.repeat(64),
      }],
    });
    expect(withGenerated.frozenInputDigest).not.toBe(first.frozenInputDigest);

    const hidden = classifyPackage(input({ entries: [entry('artifacts/qa/session.json')] }));
    expect(hidden.members[0]?.authority).toBe('');
    expect(hidden.members[0]?.path.startsWith('redacted:')).toBe(true);
  });

  it('parses the committed A envelope and predecessor package without rewriting either', () => {
    const raw = readFileSync(join(process.cwd(), 'docs/architecture/modular-monolith/post-convergence/baseline.json'), 'utf8');
    const envelope = JSON.parse(raw) as PostConvergenceEnvelope;
    const parsed = parseAHandoff(envelope);
    const loaded = loadCommittedAHandoff(process.cwd());
    expect(parsed.successorCaptureId).toBe(envelope.successorCaptureId);
    expect(parsed.packageDigest).toBe(envelope.packageDigest);
    expect(loaded.fullInventoryLocator).toContain('full-inventory.ndjson');
    expect(loaded.trackedFileCount).toBe(78494);
    const predecessor = loadCommittedPredecessorPackage(process.cwd());
    expect(predecessor.issue).toBe(1881);
    expect(predecessor.subjectIdentity).toBe(loaded.successorCaptureId);
    expect(predecessor.trackedFileCount).toBe(78494);
    expect(scanClassificationText('/Users/YW/secret')).toBe('absolute-path');
  });

  it('independently verifies full-inventory bytes and fails closed on any mismatch', () => {
    const dir = mkdtempSync(join(tmpdir(), 'payload-inventory-'));
    try {
      const locator = 'artifacts/architecture-census/x/payload-classification-inventory.ndjson';
      const lines = [JSON.stringify({ path: 'a' }), JSON.stringify({ path: 'b' })].join('\n') + '\n';
      const path = join(dir, 'inventory.ndjson');
      writeFileSync(path, lines);
      const sha = createHash('sha256').update(Buffer.from(lines)).digest('hex');
      const ok = verifyInventoryArtifact({
        inventoryAbsolutePath: path,
        expectedLocator: locator,
        expectedSha256: sha,
        expectedMemberDenominator: 2,
        subjectIdentity: 's'.repeat(64),
        toolCommit: tool.toolCommit,
      });
      expect('error' in ok).toBe(false);
      expect((ok as { sha256: string }).sha256).toBe(sha);
      const truncated = verifyInventoryArtifact({
        inventoryAbsolutePath: path,
        expectedLocator: locator,
        expectedSha256: '0'.repeat(64),
        expectedMemberDenominator: 2,
        subjectIdentity: 's'.repeat(64),
        toolCommit: tool.toolCommit,
      });
      expect(truncated).toEqual({ error: 'inventory-sha256-mismatch' });
      const wrongMembers = verifyInventoryArtifact({
        inventoryAbsolutePath: path,
        expectedLocator: locator,
        expectedSha256: sha,
        expectedMemberDenominator: 3,
        subjectIdentity: 's'.repeat(64),
        toolCommit: tool.toolCommit,
      });
      expect(wrongMembers).toEqual({ error: 'inventory-member-mismatch' });
      const unreadable = verifyInventoryArtifact({
        inventoryAbsolutePath: join(dir, 'missing.ndjson'),
        expectedLocator: locator,
        expectedSha256: sha,
        expectedMemberDenominator: 2,
        subjectIdentity: 's'.repeat(64),
        toolCommit: tool.toolCommit,
      });
      expect(unreadable).toEqual({ error: 'inventory-unreadable' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('payload classification evidence adapters', () => {
  function readerFor(blobs: Readonly<Record<string, string>>, treeEntries: readonly InventoryEntry[]): SubjectTreeReader {
    const blobBytes = (hash: string): Buffer => {
      const content = blobs[hash];
      if (content === undefined) throw new Error(`missing blob ${hash}`);
      return Buffer.from(content, 'utf8');
    };
    return {
      blobBytes,
      listEntries: (prefix: string) => treeEntries.filter((item) => item.path.startsWith(prefix)),
    };
  }

  function shaOf(content: string): string {
    return createHash('sha256').update(Buffer.from(content, 'utf8')).digest('hex');
  }

  it('proves release members against the SHA256SUMS ledger and keeps unproven roots unresolved', () => {
    const root = 'course-content/authoring/knowledge/authority/releases/snap-test';
    const memberContent = '{"release":true}';
    const memberHash = 'aa'.repeat(20);
    const sumsHash = 'bb'.repeat(20);
    const sumsContent = `${shaOf(memberContent)}  payload.json\n`;
    const entries = [
      entry(`${root}/SHA256SUMS`, sumsHash),
      entry(`${root}/payload.json`, memberHash),
      entry(`${root}/unlisted.bin`, 'cc'.repeat(20)),
      entry('course-content/authoring/knowledge/releases/bare-root/probe.json', 'dd'.repeat(20)),
    ];
    const reader = readerFor({ [sumsHash]: sumsContent, [memberHash]: memberContent }, entries);
    const bundle = buildReleaseAdapter(reader, entries);
    const overrideByPath = new Map(bundle.overrides.map((item) => [item.path, item]));
    const proven = overrideByPath.get(`${root}/payload.json`);
    expect(proven?.authority).toBe(`release-manifest:SHA256SUMS@git-blob:${sumsHash}`);
    expect(proven?.facets.releaseRoles).toEqual(['immutable-release']);
    expect(overrideByPath.has(`${root}/SHA256SUMS`)).toBe(true);
    // unlisted.bin is inside the root but absent from the ledger: no proof, no override
    expect(overrideByPath.has(`${root}/unlisted.bin`)).toBe(false);
    // bare root without identity files proves nothing
    expect(overrideByPath.has('course-content/authoring/knowledge/releases/bare-root/probe.json')).toBe(false);
    const identity = bundle.identities[0]!;
    expect(identity.candidates).toBe(3);
    expect(identity.proven).toBe(2);
    expect(identity.unresolved).toBe(1);
    expect(identity.inputDigest).toBe(shaOf(`${root}/SHA256SUMS:${sumsHash}`));
  });

  it('rejects a release member whose bytes do not match the ledger digest', () => {
    const root = 'course-content/runtime/knowledge/projection/releases/proj-x';
    const sumsHash = 'bb'.repeat(20);
    const sumsContent = `${'0'.repeat(64)}  payload.json\n`;
    const entries = [
      entry(`${root}/SHA256SUMS`, sumsHash),
      entry(`${root}/payload.json`, 'aa'.repeat(20)),
    ];
    const reader = readerFor({ [sumsHash]: sumsContent, ['aa'.repeat(20)]: '{"content":"differs"}' }, entries);
    const bundle = buildReleaseAdapter(reader, entries);
    expect(bundle.overrides.some((item) => item.path === `${root}/payload.json`)).toBe(false);
    expect(bundle.identities[0]?.unresolved).toBe(1);
  });

  it('classifies runtime export outputs as B through the frozen content-compiler toolchain and fails closed on count drift', () => {
    const scriptHash = 'ab'.repeat(20);
    const pyHash = 'ba'.repeat(20);
    const entries = [
      entry('course-content/scripts/export-runtime.sh', scriptHash),
      entry('course-content/scripts/export_runtime.py', pyHash),
      entry('course-content/runtime/lessons/1-1/lesson.json', 'cd'.repeat(20)),
    ];
    // Frozen toolchain inventory: 41 committed course-content/scripts entries including both characterization files.
    const treeEntries = [
      entry('course-content/scripts/export-runtime.sh', scriptHash),
      entry('course-content/scripts/export_runtime.py', pyHash),
      ...Array.from({ length: 39 }, (_, index) => entry(`course-content/scripts/tool-${index}.py`, pyHash)),
    ];
    const reader = readerFor({ [scriptHash]: '#!/usr/bin/env bash\n' }, treeEntries);
    const bundle = buildContentCompilerAdapter(reader, entries);
    const override = bundle.overrides.find((item) => item.path === 'course-content/runtime/lessons/1-1/lesson.json');
    expect(override?.facets.authorship).toBe('generated');
    expect(override?.facets.reproducibility).toBe('reproducible');
    expect(override?.authority).toMatch(/^toolchain:content-compiler@/);
    expect(override?.recovery).toBe('regenerate:export-runtime-from-authoring');
    expect(bundle.identities[0]?.drift).toBeNull();

    const drifted = buildContentCompilerAdapter(readerWithCount(42, scriptHash), entries);
    expect(drifted.overrides).toHaveLength(0);
    expect(drifted.identities[0]?.drift).toBe('toolchain-count-drift:43!=41');
    expect(drifted.identities[0]?.unresolved).toBe(1);

    function readerWithCount(count: number, hash: string): SubjectTreeReader {
      const many = Array.from({ length: count }, (_, index) => entry(`course-content/scripts/tool-${index}.py`, hash));
      return {
        blobBytes: () => Buffer.from('#!/usr/bin/env bash\n', 'utf8'),
        listEntries: (prefix: string) => [entry('course-content/scripts/export-runtime.sh', hash), ...many]
          .filter((item) => item.path.startsWith(prefix)),
      };
    }
  });

  it('maps the QA evidence lifecycle contract outcomes onto payload facets and classes', () => {
    const outcomes: Record<string, QaLifecycleOutcome> = {
      'artifacts/qa/shot.png': {
        evidenceClass: 'run-specific-output',
        privacyClass: 'private-run-evidence',
        retentionDecision: 'externalize-then-delete',
        owner: 'platform',
      },
      'artifacts/qa/fixture.png': {
        evidenceClass: 'representative-fixture',
        privacyClass: 'public-fixture',
        retentionDecision: 'retain-in-repo',
        owner: 'assessment',
      },
      'artifacts/qa/audit.md': {
        evidenceClass: 'audit-closure-document',
        privacyClass: 'none',
        retentionDecision: 'keep-as-audit-ledger',
        owner: 'platform',
      },
      'artifacts/qa/ledger.json': {
        evidenceClass: 'portable-manifest',
        privacyClass: 'none',
        retentionDecision: 'retain-in-repo',
        owner: 'platform',
      },
    };
    const entries = Object.keys(outcomes).map((path) => entry(path));
    const reader = readerFor({}, entries);
    const bundle = buildQaEvidenceAdapter(reader, entries, {
      classifyArtifact: (path) => outcomes[path] ?? null,
    });
    const overrideByPath = new Map(bundle.overrides.map((item) => [item.path, item]));
    const run = overrideByPath.get('artifacts/qa/shot.png');
    expect(run?.facets.privacy).toBe('private');
    expect(run?.facets.retention).toBe('existing-external-lifecycle');
    expect(run?.facets.qaRoles).toEqual(['run-specific-output']);
    expect(selectPrimaryClass({
      ...completeFacets(),
      ...run?.facets,
    })).toBe('F');
    const fixture = overrideByPath.get('artifacts/qa/fixture.png');
    expect(fixture?.facets.privacy).toBe('public');
    expect(selectPrimaryClass({ ...completeFacets(), ...fixture?.facets })).toBe('D');
    const audit = overrideByPath.get('artifacts/qa/audit.md');
    expect(audit?.facets.authorship).toBe('hand-authored');
    expect(selectPrimaryClass({ ...completeFacets(), ...audit?.facets })).toBe('A');
    const manifest = overrideByPath.get('artifacts/qa/ledger.json');
    expect(selectPrimaryClass({ ...completeFacets(), ...manifest?.facets })).toBe('B');
    expect(bundle.identities[0]?.proven).toBe(4);
    expect(bundle.identities[0]?.unresolved).toBe(0);
  });

  it('proves internal privacy from scanned content and keeps forbidden payloads unresolved', () => {
    const cleanHash = 'aa'.repeat(20);
    const dirtyHash = 'bb'.repeat(20);
    const entries = [
      entry('src/features/arena/student/rules.ts', cleanHash),
      entry('src/lib/session-note.md', dirtyHash),
      entry('docs/privacy/screenshot-cookie.png', 'cc'.repeat(20)),
    ];
    const reader = readerFor({
      [cleanHash]: 'export const rules = [];\n',
      [dirtyHash]: 'password: hunter2\n',
    }, entries);
    const bundle = buildPrivacyScanAdapter(reader, entries, {
      scanText: (text) => (text.includes('password') ? ['forbidden:password'] : []),
    });
    const overrideByPath = new Map(bundle.overrides.map((item) => [item.path, item]));
    expect(overrideByPath.get('src/features/arena/student/rules.ts')?.facets.privacy).toBe('internal');
    expect(overrideByPath.has('src/lib/session-note.md')).toBe(false);
    expect(overrideByPath.has('docs/privacy/screenshot-cookie.png')).toBe(false);
    expect(isPrivacyScanCandidate('docs/privacy/screenshot-cookie.png')).toBe(false);
    expect(isPrivacyScanCandidate('src/features/arena/student/rules.ts')).toBe(true);
    expect(bundle.identities[0]?.candidates).toBe(2);
    expect(bundle.identities[0]?.proven).toBe(1);
    expect(bundle.identities[0]?.unresolved).toBe(1);
  });
});
