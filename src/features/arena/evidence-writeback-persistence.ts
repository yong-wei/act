import type { ArenaSubmissionEvidenceWriteback } from './evidence-writeback';
import {
  buildArenaSubmissionEvidenceWriteback,
  getArenaAttemptStatus,
} from './evidence-writeback';
import type { ArenaSubmissionRecord } from './submissions/submission-service';
import { getArenaChallengeTask } from './data/seed-challenges';
import { materializeArenaTaskEvidence } from '@/lib/data-governance/simulation-task-materialization';
import { buildSimulationTaskLearningFact } from '@/lib/data-governance/simulation-task-learning-fact';
import {
  selectLearningFactAuthority,
  writeKnowledgeScopedLearningFacts,
  type LearningFactWriteRow,
} from '@/lib/canonical-learning-fact-identity';
import { resolveActiveKnowledgeRevision } from '@/lib/data-governance/knowledge-truth-revision';
import { opaqueSubjectRef } from '@/features/learning-record/event-contract/allowlist';
import type { NormalizedCourseEvidenceMapping } from '@/features/personalization/plugins/learning-record-adapter-types';

type ArenaEvidenceWritebackConsumer = 'student' | 'teacher' | 'admin' | 'service';

type ArenaWritebackDb = {
  $transaction?<T>(fn: (tx: ArenaWritebackDb) => Promise<T>): Promise<T>;
  learningFact?: {
    createMany(args: {
      data: Array<Record<string, unknown>>;
      skipDuplicates?: boolean;
    }): Promise<{ count: number }>;
  };
  evidenceOutbox?: {
    upsert(args: Record<string, unknown>): Promise<unknown>;
    findMany?(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  };
};

type ArenaWritebackReadDb = {
  evidenceOutbox?: {
    findMany?(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  };
};

export interface PersistedArenaEvidenceWritebackOutcome {
  evidenceWriteback: ArenaSubmissionEvidenceWriteback;
  dedupeKey: string;
  learningFactCreated: boolean;
}

export const ARENA_EVIDENCE_WRITEBACK_EVENT_TYPE = 'arena.kaq_evidence_writeback';

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function buildArenaWritebackDedupeKey(
  submission: ArenaSubmissionRecord,
  evidenceWriteback: ArenaSubmissionEvidenceWriteback,
): string {
  const audit = evidenceWriteback.projected?.audit;
  const targetRefs = audit?.targetRefs?.map((target) => stableJson(target)).sort().join('|') ?? 'no-target-refs';
  const versionRefs = audit?.versionRefs ? stableJson(audit.versionRefs) : 'no-version-refs';
  return [
    'arena-official',
    submission.publicationId ?? 'no-publication',
    submission.taskId,
    submission.id,
    submission.userId ?? 'no-student',
    submission.artifactHash,
    evidenceWriteback.targetLabel,
    targetRefs,
    versionRefs,
  ].join(':');
}

function toDate(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function buildOutboxPayload(input: {
  submission: ArenaSubmissionRecord;
  evidenceWriteback: ArenaSubmissionEvidenceWriteback;
  dedupeKey: string;
}) {
  return {
    schemaVersion: 'arena-evidence-writeback-outcome.v1',
    dedupeKey: input.dedupeKey,
    evidenceWriteback: input.evidenceWriteback,
    arena: {
      submissionId: input.submission.id,
      taskId: input.submission.taskId,
      userId: input.submission.userId ?? null,
      classId: input.submission.classId ?? null,
      seasonId: input.submission.seasonId ?? null,
      publicationId: input.submission.publicationId ?? null,
      artifactHash: input.submission.artifactHash,
      score: input.submission.evaluation.score,
      valid: input.submission.evaluation.valid,
      isLate: input.submission.isLate === true,
      submittedAt: input.submission.submittedAt,
    },
  };
}

async function resolveCourseAdapterMapping(input: {
  submission: ArenaSubmissionRecord;
  sourceEventId: string;
}): Promise<NormalizedCourseEvidenceMapping | null> {
  const { getRegisteredPersonalizationGoalPlugin, resolvePersonalizationGoalContext } = await import(
    '@/features/personalization/plugins/public-api'
  );
  const { mapCourseLearningRecordEvidence } = await import(
    '@/features/learning-record/course-adapters/public-api'
  );
  const resolved = resolvePersonalizationGoalContext({ taskId: input.submission.taskId });
  if (resolved.status !== 'resolved') return null;
  const plugin = getRegisteredPersonalizationGoalPlugin(resolved.context.goalId);
  const adapter = plugin?.createLearningRecordAdapter?.();
  const mapped = mapCourseLearningRecordEvidence({
    goalId: resolved.context.goalId,
    pluginId: resolved.context.pluginId,
    pluginVersion: resolved.context.pluginVersion,
    adapterVersion: adapter?.adapterVersion,
    schemaVersion: adapter?.schemaVersion,
    releaseRevision: adapter?.releaseRevision,
    captureRevision: input.submission.publicationId ?? input.submission.id,
    canonicalActivityId: input.submission.taskId,
    arenaReference: {
      taskId: input.submission.taskId,
      submissionId: input.submission.id,
    },
    sourceEventId: input.sourceEventId,
    sourceLogId: input.submission.id,
    trustedOccurredAt: input.submission.submittedAt,
    receivedAt: input.submission.submittedAt,
    subjectRef: opaqueSubjectRef(input.submission.userId ?? input.submission.id),
    idempotencyKey: input.sourceEventId,
    materialization: 'direct',
    officialArenaResult: {
      score: input.submission.evaluation.score,
      valid: input.submission.evaluation.valid,
      submissionId: input.submission.id,
    },
  });
  return mapped.status === 'mapped' ? mapped.mapping : null;
}

function buildLearningFact(input: {
  submission: ArenaSubmissionRecord;
  evidenceWriteback: ArenaSubmissionEvidenceWriteback;
  dedupeKey: string;
  mapping: NormalizedCourseEvidenceMapping | null;
}) {
  const evidenceWriteback = input.evidenceWriteback;
  const overlayUpdates = evidenceWriteback.projected?.overlayUpdates ?? [];
  const confidence = evidenceWriteback.projected?.audit?.confidence;
  const sourceEventId = input.dedupeKey;
  const mapping = input.mapping;
  return {
    userId: input.submission.userId,
    factType: 'design',
    moduleId: input.submission.taskId,
    sessionId: input.submission.publicationId ?? input.submission.seasonId ?? null,
    startedAt: toDate(input.submission.submittedAt),
    finishedAt: toDate(input.submission.submittedAt),
    outcome: 'success',
    score: input.submission.evaluation.score,
    competencyContribution: {
      arenaTransfer: {
        confidence: typeof confidence === 'number' ? confidence : null,
        terminalValidationAccepted: evidenceWriteback.terminalValidationAccepted,
        overlayCount: evidenceWriteback.overlayCount,
        targets: overlayUpdates.map((update) => update.targetRef),
      },
    },
    sourceEventId,
    sourceLogId: input.submission.id,
    courseId: mapping?.goalId ?? null,
    lessonId: mapping?.canonicalActivityId ?? mapping?.canonicalLessonId ?? null,
    contextJson: {
      ...(mapping ? { goalId: mapping.goalId } : {}),
      evidenceGovernance: {
        evidenceQuality: 'rich',
        profileWeight: 1,
        skipProfileContribution: false,
        policyReason: 'official_arena_evaluation',
      },
      arena: {
        official: true,
        evaluationMode: 'official',
        evaluationVisibility: 'official',
        taskId: input.submission.taskId,
        publicationId: input.submission.publicationId ?? null,
        classId: input.submission.classId ?? null,
        seasonId: input.submission.seasonId ?? null,
        artifactHash: input.submission.artifactHash,
        score: input.submission.evaluation.score,
        valid: input.submission.evaluation.valid,
        evidenceWriteback,
        writebackDedupeKey: input.dedupeKey,
      },
      ...(mapping
        ? {
            adapter: {
              adapterId: mapping.adapterId,
              adapterVersion: mapping.adapterVersion,
              schemaVersion: mapping.schemaVersion,
              pluginId: mapping.pluginId,
              pluginVersion: mapping.pluginVersion,
              captureRevision: mapping.captureRevision,
              releaseRevision: mapping.releaseRevision,
              contributionKind: mapping.contributionKind,
              officialAuthority: mapping.officialAuthority,
              inputDigest: mapping.inputDigest,
              trustedSetDigest: mapping.trustedSetDigest,
              sourceEventId: mapping.sourceEventId,
              sourceLogId: mapping.sourceLogId ?? null,
            },
          }
        : {}),
    },
  };
}

function buildArenaTaskLearningFact(
  submission: ArenaSubmissionRecord,
  mapping: NormalizedCourseEvidenceMapping | null,
): Record<string, unknown> | null {
  if (!submission.userId || getArenaAttemptStatus(submission) !== 'effective') return null;
  const task = getArenaChallengeTask(submission.taskId);
  const result = materializeArenaTaskEvidence({
    actor: { userId: submission.userId, role: 'student' },
    eventType: 'arena_submit',
    taskId: submission.taskId,
    submissionId: submission.id,
    occurredAt: submission.submittedAt,
    accepted: true,
    evaluationValid: submission.evaluation.valid,
    fingerprint: {
      modelRef: submission.taskId,
      controllerConfigHash: submission.artifactHash,
    },
    summary: {
      sourceRef: `ArenaSubmission:${submission.id}`,
      qualityBand: 'full',
      metrics: {
        score: submission.evaluation.score,
        valid: submission.evaluation.valid,
      },
      label: 'Arena accepted submission',
    },
    capabilityMappingTags: task?.training.capabilityTags,
  });
  if (result.status !== 'accepted' || !result.evidence) return null;
  return buildSimulationTaskLearningFact({
    userId: submission.userId,
    evidence: result.evidence,
    sourceLogId: `arena-submission:${submission.id}`,
    sessionId: submission.publicationId ?? submission.seasonId ?? null,
    courseId: mapping?.goalId ?? null,
    lessonId: mapping?.canonicalActivityId ?? mapping?.canonicalLessonId ?? null,
  }) as unknown as Record<string, unknown>;
}

function projectPersistedEvidenceWriteback(
  evidenceWriteback: ArenaSubmissionEvidenceWriteback,
  consumer: ArenaEvidenceWritebackConsumer,
): ArenaSubmissionEvidenceWriteback {
  if (consumer === 'teacher' || consumer === 'admin' || consumer === 'service') {
    return evidenceWriteback;
  }
  return {
    ...evidenceWriteback,
    limitationCodes: [],
    projected: evidenceWriteback.projected
      ? {
          ...evidenceWriteback.projected,
          audit: null,
          overlayUpdates: evidenceWriteback.projected.overlayUpdates.map((update) => ({
            ...update,
            sourceId: null,
            sourceRef: null,
            citationRefs: null,
          })),
        }
      : undefined,
  };
}

function parsePersistedEvidenceWriteback(
  row: Record<string, unknown>,
  consumer: ArenaEvidenceWritebackConsumer,
): ArenaSubmissionEvidenceWriteback | null {
  const payload = readRecord(row.payload);
  const evidenceWriteback = readRecord(payload?.evidenceWriteback);
  if (!evidenceWriteback) return null;
  if (
    evidenceWriteback.status !== 'accepted' &&
    evidenceWriteback.status !== 'degraded' &&
    evidenceWriteback.status !== 'blocked'
  ) {
    return null;
  }
  if (evidenceWriteback.status === 'accepted' && row.status !== 'processed') {
    return null;
  }
  if (!readRecord(evidenceWriteback.sourceRef)) return null;
  return projectPersistedEvidenceWriteback(
    evidenceWriteback as unknown as ArenaSubmissionEvidenceWriteback,
    consumer,
  );
}

export async function persistArenaSubmissionEvidenceWriteback(
  db: ArenaWritebackDb,
  submission: ArenaSubmissionRecord,
): Promise<PersistedArenaEvidenceWritebackOutcome> {
  const evidenceWriteback = buildArenaSubmissionEvidenceWriteback(submission, {
    actorId: 'arena-evaluator',
    consumer: 'service',
  });
  const dedupeKey = buildArenaWritebackDedupeKey(submission, evidenceWriteback);
  const payload = buildOutboxPayload({ submission, evidenceWriteback, dedupeKey });
  const materializedAt = toDate(submission.submittedAt);
  const outboxStatus = evidenceWriteback.status === 'accepted'
    ? 'processed'
    : evidenceWriteback.status;
  const officialMapping = await resolveCourseAdapterMapping({
    submission,
    sourceEventId: dedupeKey,
  });
  const taskMapping = await resolveCourseAdapterMapping({
    submission,
    sourceEventId: `arena-submission:${submission.id}`,
  });
  const taskLearningFact = buildArenaTaskLearningFact(submission, taskMapping);

  const writeOutcome = async (tx: ArenaWritebackDb): Promise<boolean> => {
    if (typeof tx.evidenceOutbox?.upsert !== 'function') {
      throw new Error('Arena evidence writeback requires EvidenceOutbox persistence.');
    }

    const learningFacts = [
      ...(evidenceWriteback.status === 'accepted'
        ? [buildLearningFact({ submission, evidenceWriteback, dedupeKey, mapping: officialMapping })]
        : []),
      ...(taskLearningFact ? [taskLearningFact] : []),
    ];
    let learningFactCreated = false;
    if (learningFacts.length > 0) {
      if (!submission.userId || typeof tx.learningFact?.createMany !== 'function') {
        throw new Error('Qualified Arena evidence writeback requires LearningFact persistence.');
      }
      // Route knowledge-scoped Arena facts through the fixed-identity adapter.
      // Pre-cutover authority selector remains LEGACY (#1116).
      const selector = selectLearningFactAuthority('FORMAL_PRODUCTION');
      const activeRevision = await resolveActiveKnowledgeRevision(tx as never);
      const result = await writeKnowledgeScopedLearningFacts(
        {
          learningFact: {
            createMany: async (args) => tx.learningFact!.createMany({
              data: args.data as unknown as Array<Record<string, unknown>>,
              skipDuplicates: args.skipDuplicates,
            }),
          },
        },
        {
          rows: learningFacts as LearningFactWriteRow[],
          knowledgeScoped: true,
        },
        {
          selector,
          knowledgeRevisionRef: activeRevision.id,
        },
      );
      learningFactCreated = result.written > 0;
    }

    await tx.evidenceOutbox.upsert({
      where: { dedupeKey },
      update: {
        payload,
        status: outboxStatus,
        availableAt: materializedAt,
        processedAt: evidenceWriteback.status === 'accepted' ? materializedAt : null,
      },
      create: {
        eventType: ARENA_EVIDENCE_WRITEBACK_EVENT_TYPE,
        correlationId: submission.publicationId ?? submission.taskId,
        causationId: submission.id,
        ownerUserId: submission.userId ?? `arena-submission:${submission.id}`,
        payload,
        dedupeKey,
        status: outboxStatus,
        availableAt: materializedAt,
        processedAt: evidenceWriteback.status === 'accepted' ? materializedAt : null,
      },
    });
    return learningFactCreated;
  };

  const learningFactCreated = db.$transaction
    ? await db.$transaction(writeOutcome)
    : await writeOutcome(db);

  return {
    evidenceWriteback: projectPersistedEvidenceWriteback(evidenceWriteback, 'student'),
    dedupeKey,
    learningFactCreated,
  };
}

export async function readArenaSubmissionEvidenceWritebacks(
  db: ArenaWritebackReadDb,
  submissionIds: readonly string[],
  consumer: ArenaEvidenceWritebackConsumer = 'student',
): Promise<Map<string, ArenaSubmissionEvidenceWriteback>> {
  const uniqueSubmissionIds = Array.from(new Set(submissionIds.filter(Boolean)));
  if (!uniqueSubmissionIds.length || typeof db.evidenceOutbox?.findMany !== 'function') {
    return new Map();
  }
  const rows = await db.evidenceOutbox.findMany({
    where: {
      eventType: ARENA_EVIDENCE_WRITEBACK_EVENT_TYPE,
      causationId: { in: uniqueSubmissionIds },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const outcomes = new Map<string, ArenaSubmissionEvidenceWriteback>();
  for (const row of rows) {
    const causationId = typeof row.causationId === 'string' ? row.causationId : null;
    if (!causationId) continue;
    const evidenceWriteback = parsePersistedEvidenceWriteback(row, consumer);
    if (evidenceWriteback) {
      const existing = outcomes.get(causationId);
      if (existing?.status === 'accepted') continue;
      outcomes.set(causationId, evidenceWriteback);
    }
  }
  return outcomes;
}
