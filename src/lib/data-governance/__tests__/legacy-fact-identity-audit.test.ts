import { describe, expect, it } from 'vitest';
import { isLearningFactEligibleForPersonalization } from '../learning-fact-quality-weight';
import {
  applyIdentityIsolationGovernance,
  buildIdentityAuditReport,
  classifyLearningFactIdentity,
  identityColumnsUnchanged,
  isolationSourceReference,
  planIdentityIsolation,
  planIdentityIsolationRestore,
  resolveAuditExecutionRevision,
  summarizeIdentityAuditForProfile,
  UNRECOVERABLE_IDENTITY_POLICY,
} from '../legacy-fact-identity-audit';

const userId = 'student-1';

function fact(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fact-1',
    knowledgeIdentityNamespace: null,
    knowledgeRevisionRef: null,
    contextJson: { knowledgeNodeIds: ['legacy-node'] },
    ...overrides,
  };
}

describe('legacy fact identity audit', () => {
  it('classifies canonical, legacy, unversioned, and crosswalk-mappable facts', () => {
    expect(classifyLearningFactIdentity(fact({
      id: 'canonical',
      knowledgeIdentityNamespace: 'CANONICAL',
      knowledgeRevisionRef: 'rev-a',
      canonicalObjectId: 'obj-1',
    }), []).classification).toBe('mappable');

    expect(classifyLearningFactIdentity(fact({
      id: 'legacy',
      knowledgeIdentityNamespace: 'LEGACY',
      knowledgeRevisionRef: 'rev-legacy',
    }), []).classification).toBe('legacy_only');

    expect(classifyLearningFactIdentity(fact({
      id: 'missing',
    }), []).classification).toBe('undetermined');

    expect(classifyLearningFactIdentity(fact({
      id: 'mapped',
      knowledgeIdentityNamespace: 'LEGACY',
      knowledgeRevisionRef: null,
      contextJson: { knowledgeNodeIds: ['old-1'] },
    }), [{
      legacyId: 'old-1',
      canonicalId: 'new-1',
      stale: false,
    }]).classification).toBe('mappable');

    const partial = classifyLearningFactIdentity(fact({
      id: 'partial',
      knowledgeIdentityNamespace: 'LEGACY',
      knowledgeRevisionRef: 'rev-legacy',
      contextJson: { knowledgeNodeIds: ['old-1', 'old-missing'] },
    }), [{
      legacyId: 'old-1',
      canonicalId: 'new-1',
      stale: false,
    }]);
    expect(partial.classification).toBe('undetermined');
    expect(partial.reason).toBe('legacy_crosswalk_partial');
    expect(partial.unresolvedLegacyIds).toEqual(['old-missing']);
  });

  it('is read-only and repeatable', () => {
    const facts = [
      fact({ id: 'a', knowledgeIdentityNamespace: 'CANONICAL', knowledgeRevisionRef: 'rev-a' }),
      fact({ id: 'b', knowledgeIdentityNamespace: 'LEGACY', knowledgeRevisionRef: 'rev-b' }),
      fact({ id: 'c' }),
    ];
    const first = buildIdentityAuditReport({ userId, facts });
    const second = buildIdentityAuditReport({ userId, facts });
    expect(first.counts).toEqual({
      mappable: 1,
      legacy_only: 1,
      undetermined: 1,
      isolated: 0,
      anomalies: 0,
    });
    expect(second.counts).toEqual(first.counts);
    expect(second.rows.map((row) => row.classification)).toEqual(first.rows.map((row) => row.classification));
    expect(facts[2].knowledgeIdentityNamespace).toBeNull();
  });

  it('isolates undetermined facts idempotently without touching identity columns', () => {
    const undetermined = fact({ id: 'c' });
    const first = planIdentityIsolation({
      userId,
      facts: [undetermined, fact({
        id: 'legacy',
        knowledgeIdentityNamespace: 'LEGACY',
        knowledgeRevisionRef: 'rev-b',
      })],
      existingSourceReferences: [],
      executionRevision: 'rev-test',
    });
    expect(first.writes).toHaveLength(1);
    expect(first.writes[0].factId).toBe('c');
    expect(first.writes[0].nextContext.evidenceGovernance).toMatchObject({
      profileWeight: 0,
      skipProfileContribution: true,
      policyReason: UNRECOVERABLE_IDENTITY_POLICY,
      identityIsolation: {
        isolated: true,
        executionRevision: 'rev-test',
        previousGovernance: {},
      },
    });
    expect(first.report.countsBefore).toEqual({
      mappable: 0,
      legacy_only: 1,
      undetermined: 1,
      isolated: 0,
      anomalies: 0,
    });
    expect(first.report.counts.isolated).toBe(1);
    expect(identityColumnsUnchanged(undetermined, {
      ...undetermined,
      contextJson: first.writes[0].nextContext,
    })).toBe(true);
    expect(isLearningFactEligibleForPersonalization(first.writes[0].nextContext)).toBe(false);

    const second = planIdentityIsolation({
      userId,
      facts: [{ ...undetermined, contextJson: first.writes[0].nextContext }],
      existingSourceReferences: first.writes.map((write) => write.transition.sourceReference ?? ''),
      executionRevision: 'rev-test',
    });
    expect(second.writes).toHaveLength(0);
    expect(second.report.counts.isolated).toBe(1);

    const partial = planIdentityIsolation({
      userId,
      facts: [fact({
        id: 'partial',
        knowledgeIdentityNamespace: 'LEGACY',
        knowledgeRevisionRef: 'rev-legacy',
        contextJson: { knowledgeNodeIds: ['old-1', 'old-missing'] },
      })],
      existingSourceReferences: [],
      executionRevision: 'rev-test',
      crosswalk: [{
        legacyId: 'old-1',
        canonicalId: 'new-1',
        stale: false,
      }],
    });
    expect(partial.writes).toHaveLength(1);
    expect(partial.report.counts.undetermined).toBe(1);
    expect(partial.report.anomalies).toEqual([
      { factId: 'partial', message: 'legacy_crosswalk_partial' },
    ]);
  });

  it('restores isolation from the recorded previous governance', () => {
    const source = fact({ id: 'c', contextJson: { knowledgeNodeIds: ['legacy-node'], keep: true } });
    const isolated = applyIdentityIsolationGovernance(source.contextJson, 'rev-test');
    const restore = planIdentityIsolationRestore({
      userId,
      facts: [{ ...source, contextJson: isolated.nextContext }],
      previousGovernanceByFactId: new Map([['c', isolated.previousGovernance]]),
      existingSourceReferences: [isolationSourceReference('c')],
      executionRevision: 'rev-test',
    });
    expect(restore.writes).toHaveLength(1);
    expect(restore.writes[0].nextContext).toEqual(source.contextJson);
    expect(isLearningFactEligibleForPersonalization(restore.writes[0].nextContext)).toBe(false);

    const fromFact = planIdentityIsolationRestore({
      userId,
      facts: [{ ...source, contextJson: isolated.nextContext }],
      previousGovernanceByFactId: new Map(),
      existingSourceReferences: [isolationSourceReference('c')],
      executionRevision: 'rev-test',
    });
    expect(fromFact.writes[0].nextContext).toEqual(source.contextJson);
    expect(fromFact.report.countsBefore?.isolated).toBe(1);
    expect(fromFact.report.counts.isolated).toBe(0);
  });

  it('refuses captured audit execution without a real revision', () => {
    const previousApp = process.env.APP_REVISION;
    const previousGit = process.env.GIT_SHA;
    delete process.env.APP_REVISION;
    delete process.env.GIT_SHA;
    try {
      expect(() => resolveAuditExecutionRevision({ requireCapture: true }))
        .toThrow('identity-audit-missing-execution-revision');
      expect(() => resolveAuditExecutionRevision({
        requireCapture: true,
        gitHead: 'a2377a630b1006979b896516011888735b1fc510',
        dirty: true,
      })).toThrow('identity-audit-dirty-worktree');
      expect(resolveAuditExecutionRevision({
        requireCapture: true,
        gitHead: 'a2377a630b1006979b896516011888735b1fc510',
      })).toBe('a2377a630b1006979b896516011888735b1fc510');
      expect(resolveAuditExecutionRevision()).toBe('unspecified-local');
    } finally {
      if (previousApp === undefined) delete process.env.APP_REVISION;
      else process.env.APP_REVISION = previousApp;
      if (previousGit === undefined) delete process.env.GIT_SHA;
      else process.env.GIT_SHA = previousGit;
    }
  });

  it('surfaces mixed-version limits and isolated counts for the profile', () => {
    const report = buildIdentityAuditReport({
      userId,
      facts: [
        fact({ id: 'a', knowledgeIdentityNamespace: 'CANONICAL', knowledgeRevisionRef: 'rev-a' }),
        fact({
          id: 'c',
          contextJson: {
            evidenceGovernance: {
              profileWeight: 0,
              skipProfileContribution: true,
              policyReason: UNRECOVERABLE_IDENTITY_POLICY,
              identityIsolation: { isolated: true },
            },
          },
        }),
      ],
    });
    const summary = summarizeIdentityAuditForProfile(report);
    expect(summary.singleVersionComparable).toBe(false);
    expect(summary.availability).toBe('mixed-version');
    expect(summary.isolatedCount).toBe(1);
    expect(summary.isolatedStatus).toBe('restricted');
    expect(summary.mixedVersionLimitation).toMatch(/单一版本/);
  });
});
