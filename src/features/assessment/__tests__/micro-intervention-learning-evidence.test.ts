import { describe, expect, it } from 'vitest';

import { rebuildMasteryUpdatesFromAnswers } from '../adaptive-mastery';
import {
  applyMicroInterventionEvidenceSummaryToPathPlan,
  applyMicroInterventionMasteryPolicy,
  buildPublicMicroInterventionEvidenceReport,
  projectMicroInterventionOutcome,
  readSealedMicroInterventionProjectionSource,
  summarizeMicroInterventionEvidenceForPath,
  type MicroInterventionEvidenceDb,
  type MicroInterventionEvidenceIdentity,
  type SealedMicroInterventionOutcome,
} from '../micro-intervention-learning-evidence';
import { MICRO_INTERVENTION_EVIDENCE_ALGORITHM_VERSION } from '../micro-intervention-evidence-policy';
import { resolveLearningFactEvidenceGovernance } from '@/lib/data-governance/learning-fact-quality-weight';

const IDENTITY: MicroInterventionEvidenceIdentity = {
  canonicalObjectId: 'kn:autocontrol:phase-margin',
  aggregateReleaseSetId: 'release-set-1',
  aggregateReleaseId: 'release-1',
  knowledgeProjectionId: 'teaching-projection-1',
  captureRevision: 'abc123capture',
  courseId: 'course-1',
};

function sealedOutcome(overrides: Partial<SealedMicroInterventionOutcome> = {}): SealedMicroInterventionOutcome {
  return {
    id: 'intervention-1',
    userId: 'learner-1',
    learnerSessionId: 'session-1',
    startedAt: new Date('2026-08-21T00:00:00.000Z'),
    sourceSnapshot: {
      task: {
        goal: 'control-correction',
        sourceQuestionId: 'source-q-1',
        knowledgeNodeId: 'kn:autocontrol:phase-margin',
        misconceptionTag: 'phase-lag',
        validationQuestion: {
          itemRefId: 'item-1',
          questionId: 'validation-q-1',
          contentHash: 'hash-1',
          version: 'validation.v1',
        },
      },
    },
    events: [{
      id: 'event-1',
      eventType: 'RESOURCE_USED',
      occurredAt: new Date('2026-08-21T00:01:00.000Z'),
    }],
    validation: {
      id: 'validation-1',
      isCorrect: true,
      submittedAt: new Date('2026-08-21T00:05:00.000Z'),
      questionId: 'validation-q-1',
      questionContentHash: 'hash-1',
      questionVersion: 'validation.v1',
    },
    ...overrides,
  };
}

function createDb() {
  const facts: Array<{ sourceEventId?: string | null; contextJson?: unknown; factType: string }> = [];
  const outbox = new Map<string, { status: string; payload: unknown; ownerUserId: string; dedupeKey: string }>();
  const db: MicroInterventionEvidenceDb = {
    learningFact: {
      createMany: async ({ data, skipDuplicates }) => {
        const rows = Array.isArray(data) ? data : [];
        let count = 0;
        for (const row of rows) {
          if (skipDuplicates && facts.some((fact) => fact.sourceEventId && fact.sourceEventId === row.sourceEventId)) {
            continue;
          }
          facts.push(row as typeof facts[number]);
          count += 1;
        }
        return { count };
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const fact of facts) {
          if (fact.sourceEventId === where.sourceEventId) {
            Object.assign(fact, data);
            count += 1;
          }
        }
        return { count };
      },
    },
    evidenceOutbox: {
      upsert: async ({ where, create, update }) => {
        const existing = outbox.get(where.dedupeKey);
        if (existing) {
          const next = { ...existing, ...update };
          outbox.set(where.dedupeKey, next);
          return { id: where.dedupeKey, ...next };
        }
        const created = {
          status: create.status,
          payload: create.payload,
          ownerUserId: create.ownerUserId,
          dedupeKey: create.dedupeKey,
        };
        outbox.set(create.dedupeKey, created);
        return { id: create.dedupeKey, ...created };
      },
      findMany: async ({ where }) => [...outbox.values()]
        .filter((row) => !where.ownerUserId || row.ownerUserId === where.ownerUserId)
        .map((row) => ({ id: row.dedupeKey, ...row })),
    },
  };
  return { db, facts, outbox };
}

describe('micro-intervention learning evidence', () => {
  it('does not create a LearningFact when identity is incomplete', async () => {
    const { db, facts } = createDb();
    const result = await projectMicroInterventionOutcome({
      db,
      outcome: sealedOutcome(),
      identity: null,
    });
    expect(result.writtenFacts).toBe(0);
    expect(result.limitations).toContain('identity-incomplete');
    expect(facts).toHaveLength(0);
  });

  it('projects participation as zero-weight context and validation as bounded evidence', async () => {
    const { db, facts, outbox } = createDb();
    const first = await projectMicroInterventionOutcome({
      db,
      outcome: sealedOutcome(),
      identity: IDENTITY,
      consume: true,
    });
    const replayed = await projectMicroInterventionOutcome({
      db,
      outcome: sealedOutcome(),
      identity: IDENTITY,
      consume: true,
    });
    expect(first.writtenFacts).toBe(2);
    expect(replayed.writtenFacts).toBe(0);
    expect(facts).toHaveLength(2);
    expect(facts.map((fact) => fact.factType).sort()).toEqual([
      'micro_intervention_context',
      'micro_intervention_validation',
    ]);
    const validation = facts.find((fact) => fact.factType === 'micro_intervention_validation');
    const governance = (validation?.contextJson as { evidenceGovernance: { profileWeight: number; skipProfileContribution: boolean } })
      .evidenceGovernance;
    expect(governance.profileWeight).toBe(0.25);
    expect(governance.skipProfileContribution).toBe(false);
    const { db: upgradeDb, facts: upgradedFacts } = createDb();
    await projectMicroInterventionOutcome({
      db: upgradeDb,
      outcome: sealedOutcome(),
      identity: IDENTITY,
      consume: false,
    });
    await projectMicroInterventionOutcome({
      db: upgradeDb,
      outcome: sealedOutcome(),
      identity: IDENTITY,
      consume: true,
    });
    const sealed = upgradedFacts.find((fact) => fact.factType === 'micro_intervention_validation');
    expect((sealed?.contextJson as { evidenceGovernance: { profileWeight: number } }).evidenceGovernance.profileWeight).toBe(0);
    const consumed = applyMicroInterventionMasteryPolicy([{
      evidenceId: 'src',
      canonicalNodeId: 'kn:autocontrol:controller-correction',
      isCorrect: true,
      occurredAt: new Date('2026-08-21T00:05:00.000Z'),
    }]);
    expect(consumed[0]?.profileWeight).toBe(0.25);
    expect(JSON.stringify([...outbox.values()])).not.toContain('source-q-1');
    expect(JSON.stringify([...outbox.values()])).not.toContain('phase-lag');
    expect(JSON.stringify(facts)).not.toContain('selectedOption');
  });

  it('keeps validation in shadow mode until the consumer flag is enabled', async () => {
    const { db, facts } = createDb();
    await projectMicroInterventionOutcome({
      db,
      outcome: sealedOutcome(),
      identity: IDENTITY,
      consume: false,
    });
    const validation = facts.find((fact) => fact.factType === 'micro_intervention_validation');
    const governance = (validation?.contextJson as { evidenceGovernance: { profileWeight: number; skipProfileContribution: boolean; policyReason: string } })
      .evidenceGovernance;
    expect(governance.profileWeight).toBe(0);
    expect(governance.skipProfileContribution).toBe(true);
    expect(governance.policyReason).toBe('micro_intervention_validation_shadow');
  });

  it('suppresses short-window repeats and conflicts in path summaries without unlocking mastery', () => {
    const source = readSealedMicroInterventionProjectionSource(sealedOutcome(), IDENTITY);
    const secondPass = {
      ...source.envelopes[1],
      evidenceId: 'repeat',
      occurredAt: '2026-08-21T01:00:00.000Z',
    };
    const conflict = {
      ...source.envelopes[1],
      evidenceId: 'conflict',
      isCorrect: false,
      occurredAt: '2026-08-22T00:00:00.000Z',
    };
    const summary = summarizeMicroInterventionEvidenceForPath([
      ...source.envelopes,
      secondPass,
      conflict,
    ]);
    expect(summary?.limitations).toEqual(expect.arrayContaining(['repeat-suppressed', 'conflict', 'not-terminal-mastery']));
    const plan = applyMicroInterventionEvidenceSummaryToPathPlan({
      masteredCanonicalIds: ['kn:autocontrol:phase-margin', 'other'],
      limitations: [],
    }, summary, { consume: true });
    expect(plan.masteredCanonicalIds).toEqual(['kn:autocontrol:phase-margin', 'other']);
    expect(plan.limitations).toContain('micro-intervention:hold-assessment-gates');
  });

  it('rebuilds the same mastery posterior for the same micro-intervention evidence set', () => {
    const evidence = [{
      evidenceId: 'mi-1',
      knowledgeTag: 'phase-margin',
      isCorrect: true,
      occurredAt: new Date('2026-08-21T00:05:00.000Z'),
      profileWeight: 0.25,
      limitations: ['not-terminal-mastery'],
    }];
    const first = rebuildMasteryUpdatesFromAnswers([], {
      consumeMicroInterventionEvidence: true,
      microInterventionEvidence: evidence,
    });
    const second = rebuildMasteryUpdatesFromAnswers([], {
      consumeMicroInterventionEvidence: true,
      microInterventionEvidence: [...evidence],
    });
    expect(second).toEqual(first);
    expect(first[0]?.evidenceKind).toBe('non_assessment');
    expect(first[0]?.confidence).toBeLessThan(0.7);
    const fullWeight = rebuildMasteryUpdatesFromAnswers([], {
      consumeMicroInterventionEvidence: true,
      microInterventionEvidence: [{ ...evidence[0], profileWeight: 1 }],
    });
    expect(first[0]?.posteriorMastery).toBeLessThan(fullWeight[0]?.posteriorMastery ?? 1);

    const mapped = rebuildMasteryUpdatesFromAnswers([], {
      consumeMicroInterventionEvidence: true,
      microInterventionEvidence: applyMicroInterventionMasteryPolicy([{
        evidenceId: 'src',
        canonicalNodeId: 'kn:autocontrol:controller-correction',
        isCorrect: true,
        occurredAt: new Date('2026-08-21T00:05:00.000Z'),
      }]),
    });
    expect(mapped[0]?.knowledgeTag).toBe('controller-tuning');
  });

  it('does not consume micro-intervention evidence when the consumer flag is off', () => {
    const updates = rebuildMasteryUpdatesFromAnswers([], {
      consumeMicroInterventionEvidence: false,
      microInterventionEvidence: [{
        evidenceId: 'mi-1',
        knowledgeTag: 'phase-margin',
        isCorrect: true,
        occurredAt: new Date('2026-08-21T00:05:00.000Z'),
        profileWeight: 0.25,
        limitations: [],
      }],
    });
    expect(updates).toEqual([]);
  });

  it('suppresses public reports below the independent-learner threshold', () => {
    const rows = Array.from({ length: 4 }, (_, index) => ({
      ownerUserId: `learner-${index}`,
      payload: { kind: 'independent-validation', isCorrect: true, canonicalNodeId: 'kn:1' },
    }));
    expect(buildPublicMicroInterventionEvidenceReport(rows)).toMatchObject({ suppressed: true, learnerCount: 0 });
    rows.push({
      ownerUserId: 'learner-4',
      payload: { kind: 'independent-validation', isCorrect: false, canonicalNodeId: 'kn:1' },
    });
    expect(buildPublicMicroInterventionEvidenceReport(rows)).toMatchObject({
      suppressed: false,
      learnerCount: 5,
      validationCount: 5,
    });
  });

  it('assigns zero profile weight to participation events in the quality policy', () => {
    expect(resolveLearningFactEvidenceGovernance('micro_intervention_context', {})).toMatchObject({
      profileWeight: 0,
      skipProfileContribution: true,
      policyReason: 'micro_intervention_context_only',
    });
    expect(MICRO_INTERVENTION_EVIDENCE_ALGORITHM_VERSION).toBe('micro-intervention-evidence.v1');
  });
});
