import { describe, expect, it } from 'vitest';

import { rebuildMasteryUpdatesFromAnswers } from '../adaptive-mastery';
import {
  applyMicroInterventionEvidenceSummaryToPathPlan,
  applyMicroInterventionMasteryPolicy,
  enqueueMicroInterventionEvidenceProjection,
  processPendingMicroInterventionEvidenceProjections,
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

function createDb(initialOutcome: SealedMicroInterventionOutcome | null = sealedOutcome()) {
  const facts: Array<{ sourceEventId?: string | null; contextJson?: unknown; factType: string }> = [];
  const outbox = new Map<string, {
    status: string;
    payload: unknown;
    ownerUserId: string;
    dedupeKey: string;
    correlationId?: string;
    causationId?: string;
    eventType?: string;
  }>();
  let outcome = initialOutcome;
  const db = {
    learningFact: {
      createMany: async ({ data, skipDuplicates }: { data: Array<{ sourceEventId?: string | null }>; skipDuplicates?: boolean }) => {
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
      updateMany: async ({ where, data }: { where: { sourceEventId: string }; data: { contextJson: unknown } }) => {
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
      upsert: async ({ where, create, update }: {
        where: { dedupeKey: string };
        create: {
          status: string;
          payload: unknown;
          ownerUserId: string;
          dedupeKey: string;
          correlationId?: string;
          causationId?: string;
          eventType?: string;
        };
        update: Record<string, unknown>;
      }) => {
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
          correlationId: create.correlationId,
          causationId: create.causationId,
          eventType: create.eventType,
        };
        outbox.set(create.dedupeKey, created);
        return { id: create.dedupeKey, ...created };
      },
      findMany: async ({ where }: { where: { eventType?: string; ownerUserId?: string; status?: string; correlationId?: string } }) => [...outbox.values()]
        .filter((row) => !where.eventType || row.eventType === where.eventType)
        .filter((row) => !where.ownerUserId || row.ownerUserId === where.ownerUserId)
        .filter((row) => !where.status || row.status === where.status)
        .filter((row) => !where.correlationId || row.correlationId === where.correlationId)
        .map((row) => ({ id: row.dedupeKey, ...row })),
      update: async ({ where, data }: { where: { dedupeKey?: string; id?: string }; data: Record<string, unknown> }) => {
        const key = where.dedupeKey ?? where.id;
        const existing = key ? outbox.get(key) : undefined;
        if (!existing) return {};
        const next = { ...existing, ...data };
        outbox.set(existing.dedupeKey, next);
        return next;
      },
    },
    microInterventionOutcome: {
      findFirst: async ({ where }: { where: { id: string } }) => (
        outcome && outcome.id === where.id ? outcome : null
      ),
    },
  };
  return {
    db: db as unknown as MicroInterventionEvidenceDb,
    facts,
    outbox,
    setOutcome: (next: SealedMicroInterventionOutcome | null) => {
      outcome = next;
    },
  };
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
    expect(mapped[0]?.prerequisiteEvidence.microInterventionLimitations).toEqual(['not-terminal-mastery']);
    const conflicted = rebuildMasteryUpdatesFromAnswers([{
      id: 'answer-1',
      questionId: 'q-1',
      isCorrect: true,
      answeredAt: new Date('2026-08-21T00:10:00.000Z'),
      knowledgeTags: ['controller-tuning'],
    }], {
      consumeMicroInterventionEvidence: true,
      microInterventionEvidence: applyMicroInterventionMasteryPolicy([
        {
          evidenceId: 'pass',
          canonicalNodeId: 'kn:autocontrol:controller-correction',
          isCorrect: true,
          occurredAt: new Date('2026-08-21T00:05:00.000Z'),
        },
        {
          evidenceId: 'fail',
          canonicalNodeId: 'kn:autocontrol:controller-correction',
          isCorrect: false,
          occurredAt: new Date('2026-08-22T00:05:00.000Z'),
        },
      ]),
    });
    expect(conflicted[0]?.prerequisiteEvidence.microInterventionLimitations).toContain('conflict');
    const isolated = rebuildMasteryUpdatesFromAnswers([
      {
        id: 'answer-pm',
        questionId: 'q-pm',
        isCorrect: true,
        answeredAt: new Date('2026-08-21T00:10:00.000Z'),
        knowledgeTags: ['phase-margin'],
      },
      {
        id: 'answer-ct',
        questionId: 'q-ct',
        isCorrect: true,
        answeredAt: new Date('2026-08-21T00:11:00.000Z'),
        knowledgeTags: ['controller-tuning'],
      },
    ], {
      consumeMicroInterventionEvidence: true,
      microInterventionEvidence: applyMicroInterventionMasteryPolicy([
        {
          evidenceId: 'pass',
          canonicalNodeId: 'kn:autocontrol:controller-correction',
          isCorrect: true,
          occurredAt: new Date('2026-08-21T00:05:00.000Z'),
        },
        {
          evidenceId: 'fail',
          canonicalNodeId: 'kn:autocontrol:controller-correction',
          isCorrect: false,
          occurredAt: new Date('2026-08-22T00:05:00.000Z'),
        },
      ]),
    });
    expect(isolated.find((item) => item.knowledgeTag === 'phase-margin')?.prerequisiteEvidence.microInterventionLimitations)
      .toBeUndefined();
    expect(isolated.find((item) => item.knowledgeTag === 'controller-tuning')?.prerequisiteEvidence.microInterventionLimitations)
      .toContain('conflict');
    const early = applyMicroInterventionMasteryPolicy([{
      evidenceId: 'src',
      canonicalNodeId: 'kn:autocontrol:controller-correction',
      isCorrect: true,
      occurredAt: new Date('2026-08-01T00:00:00.000Z'),
    }], new Date('2026-08-02T00:00:00.000Z'));
    const late = applyMicroInterventionMasteryPolicy([{
      evidenceId: 'src',
      canonicalNodeId: 'kn:autocontrol:controller-correction',
      isCorrect: true,
      occurredAt: new Date('2026-08-01T00:00:00.000Z'),
    }], new Date('2026-08-20T00:00:00.000Z'));
    expect(early[0]?.profileWeight).toBeGreaterThan(late[0]?.profileWeight ?? 0);
    expect(applyMicroInterventionMasteryPolicy([{
      evidenceId: 'src',
      canonicalNodeId: 'kn:autocontrol:controller-correction',
      isCorrect: true,
      occurredAt: new Date('2026-08-01T00:00:00.000Z'),
    }], new Date('2026-08-20T00:00:00.000Z'))).toEqual(late);
  });

  it('consumes pending projection tasks and records projected or failed status', async () => {
    const { db, facts, outbox } = createDb();
    await enqueueMicroInterventionEvidenceProjection({
      db,
      interventionId: 'intervention-1',
      ownerUserId: 'learner-1',
    });
    const result = await processPendingMicroInterventionEvidenceProjections({
      ...db,
      microInterventionOutcome: {
        findFirst: async () => sealedOutcome(),
      },
    } as never, { interventionId: 'intervention-1' });
    expect(result.processed).toBe(1);
    const tasks = [...outbox.values()].filter((row) => String(row.dedupeKey).startsWith('micro-intervention:pending:'));
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.status).toBe('projected');
    expect(facts.length).toBeGreaterThan(0);
  });

  it('queues a new pending task when later sealed validation arrives', async () => {
    const { db, facts, outbox, setOutcome } = createDb(sealedOutcome({ validation: null }));
    const processor = db as never;
    await enqueueMicroInterventionEvidenceProjection({
      db,
      interventionId: 'intervention-1',
      ownerUserId: 'learner-1',
    });
    await processPendingMicroInterventionEvidenceProjections(processor, { interventionId: 'intervention-1' });
    expect(facts.some((fact) => fact.factType === 'micro_intervention_validation')).toBe(false);
    const firstTasks = [...outbox.values()].filter((row) => String(row.dedupeKey).startsWith('micro-intervention:pending:'));
    expect(firstTasks).toHaveLength(1);
    expect(firstTasks[0]?.status).toBe('projected');

    setOutcome(sealedOutcome());
    await enqueueMicroInterventionEvidenceProjection({
      db,
      interventionId: 'intervention-1',
      ownerUserId: 'learner-1',
    });
    const pendingAfter = [...outbox.values()].filter((row) => (
      String(row.dedupeKey).startsWith('micro-intervention:pending:') && row.status === 'pending'
    ));
    expect(pendingAfter).toHaveLength(1);
    expect(pendingAfter[0]?.dedupeKey).not.toBe(firstTasks[0]?.dedupeKey);

    await processPendingMicroInterventionEvidenceProjections(processor, { interventionId: 'intervention-1' });
    expect(facts.some((fact) => fact.factType === 'micro_intervention_validation')).toBe(true);
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
