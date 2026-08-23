import { describe, expect, it } from 'vitest';

import { FormalResourceRemediationError } from '@/lib/formal-resource-remediation/contracts';
import { reopenScopeArtifact } from '@/lib/formal-resource-remediation/relations/scope';
import {
  applyCourseOwnerDecisions,
  runRelationPipeline,
  sealCourseOwnerDecision,
} from '@/lib/formal-resource-remediation/relations/pipeline';

const H = (c: string) => c.repeat(64);

function scopeFixture(memberCount = 3) {
  const members = Array.from({ length: memberCount }, (_, index) => ({
    canonicalId: `ctc:member-${index}`,
    domainIds: [`domain-${index % 2}`],
    preferredDomainId: `domain-${index % 2}`,
  }));
  return {
    contract: 'act-canonical-teaching-scope/v1',
    courseId: 'act-control-theory',
    authority: { releaseId: 'ctr:release:v0.22', snapshotHash: H('a') },
    catalog: { catalogHash: H('b') },
    scopeHash: H('c'),
    memberCount,
    memberIds: members.map((member) => member.canonicalId),
    members,
  };
}

function reopenedScope(memberCount = 3) {
  return reopenScopeArtifact({
    courseId: 'act-control-theory',
    scope: scopeFixture(memberCount),
    expectedAuthorityReleaseId: 'ctr:release:v0.22',
    expectedAuthoritySnapshotHash: H('a'),
  });
}

describe('capture-bound scope derivation', () => {
  it('reopens members from the artifact and rejects caller drift', () => {
    const scope = reopenedScope();
    expect(scope.memberCount).toBe(3);
    expect(scope.derivedScopeDigest).toMatch(/^[a-f0-9]{64}$/);
    const drifted = scopeFixture();
    drifted.authority = { releaseId: 'ctr:release:v0.9', snapshotHash: H('a') };
    expect(() => reopenScopeArtifact({
      courseId: 'act-control-theory',
      scope: drifted,
      expectedAuthorityReleaseId: 'ctr:release:v0.22',
      expectedAuthoritySnapshotHash: H('a'),
    })).toThrow(/different Authority capture/);
    const duplicated = scopeFixture();
    duplicated.members = [...duplicated.members, duplicated.members[0]];
    duplicated.memberCount = 4;
    duplicated.memberIds = duplicated.members.map((member) => member.canonicalId);
    expect(() => reopenScopeArtifact({
      courseId: 'act-control-theory',
      scope: duplicated,
      expectedAuthorityReleaseId: 'ctr:release:v0.22',
      expectedAuthoritySnapshotHash: H('a'),
    })).toThrow(/appears twice/);
  });
});

function pendingRows(scopeHash: string) {
  const rows = [];
  for (const index of [0, 1, 2]) {
    rows.push({
      canonicalId: `ctc:member-${index}`,
      family: 'containment' as const,
      kind: 'PENDING_REVIEW',
      reason: 'no-explicit-parent-or-root-evidence',
      scopeHash,
    });
    rows.push({
      canonicalId: `ctc:member-${index}`,
      family: 'prerequisite' as const,
      kind: 'PENDING_REVIEW',
      reason: 'awaiting-qualified-item-evidence',
      scopeHash,
    });
  }
  return rows;
}

describe('relation pipeline and decision applier', () => {
  it('clusters every pending row into immutable domain review packs', () => {
    const scope = reopenedScope();
    const result = runRelationPipeline({ scope, pendingRows: pendingRows(scope.scopeHash), evidenceRegistry: null });
    expect(result.admittedRowCount).toBe(0);
    expect(result.pendingRowCount).toBe(6);
    expect(result.reviewPacks.length).toBe(2);
    const totalRows = result.reviewPacks.reduce((total, pack) => total + pack.rows.length, 0);
    expect(totalRows).toBe(6);
    expect(result.reviewPacks.every((pack) => pack.contract === 'remediation-relation-review-pack/v1')).toBe(true);
    // Deterministic clustering: same inputs, same pipeline hash.
    const again = runRelationPipeline({ scope, pendingRows: pendingRows(scope.scopeHash), evidenceRegistry: null });
    expect(again.pipelineHash).toBe(result.pipelineHash);
    expect(() => runRelationPipeline({
      scope,
      pendingRows: [...pendingRows(H('z'))],
      evidenceRegistry: null,
    })).toThrow(/binds scope/);
  });

  it('applies evidencend course-owner decisions and counts unresolved rows', () => {
    const scope = reopenedScope();
    const result = runRelationPipeline({ scope, pendingRows: pendingRows(scope.scopeHash), evidenceRegistry: null });
    const evidenceRegistry = {
      registryId: 'frozen-course-sources/v1',
      knows: (ref: string) => ref.startsWith('src:'),
    };
    const pack = result.reviewPacks[0];
    const row = pack.rows[0];
    const decision = sealCourseOwnerDecision({
      allocationHash: H('f'),
      reviewPackId: pack.packId,
      canonicalId: row.canonicalId,
      family: row.family,
      decision: 'no-relation',
      decidedBy: 'course-owner',
      decidedAt: '2026-08-23T00:00:00.000Z',
      evidenceRefs: ['src:handout-1-1#p-1'],
      rationale: '讲义未建立先修关系',
    });
    const applied = applyCourseOwnerDecisions({
      scope,
      reviewPacks: result.reviewPacks,
      decisions: [decision],
      evidenceRegistry,
      expectedCourseOwnerId: 'course-owner',
      expectedAllocationHash: H('f'),
    });
    expect(applied.outcomes[0]?.finalDisposition.kind).toBe('NO_RELATION');
    expect(applied.unresolvedAfterApplication).toBe(5);

    // Unevidenced no-relation fails closed before any hash consideration.
    expect(() => applyCourseOwnerDecisions({
      scope,
      reviewPacks: result.reviewPacks,
      decisions: [{
        ...decision,
        evidenceRefs: [],
        decisionHash: 'x'.repeat(64),
      }],
      evidenceRegistry,
      expectedCourseOwnerId: 'course-owner',
      expectedAllocationHash: H('f'),
    })).toThrow(/unevidenced NO_RELATION/);
    expect(() => applyCourseOwnerDecisions({
      scope,
      reviewPacks: result.reviewPacks,
      decisions: [{ ...decision, decidedBy: 'someone-else' }],
      evidenceRegistry,
      expectedCourseOwnerId: 'course-owner',
      expectedAllocationHash: H('f'),
    })).toThrow(/does not match its own sealed hash|course owner/);
    const unevidenced = sealCourseOwnerDecision({
      allocationHash: H('f'),
      reviewPackId: pack.packId,
      canonicalId: row.canonicalId,
      family: row.family,
      decision: 'no-relation',
      decidedBy: 'course-owner',
      decidedAt: '2026-08-23T00:00:00.000Z',
      evidenceRefs: ['arbitrary-string'],
      rationale: 'x',
    });
    expect(() => applyCourseOwnerDecisions({
      scope,
      reviewPacks: result.reviewPacks,
      decisions: [unevidenced],
      evidenceRegistry,
      expectedCourseOwnerId: 'course-owner',
      expectedAllocationHash: H('f'),
    })).toThrow(/does not know/);
  });
});
