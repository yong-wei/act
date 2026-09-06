/**
 * learner-state 效应读取层（Issue #1969）。
 *
 * 数据库分页、画像读取、证据缓存与持久化写回集中于此；
 * `internal.ts` 保持纯函数与契约，reducer 的依赖图不再传递可达 I/O 运行时。
 */
import { readArenaSubmissionEvidenceWritebacks } from '@/features/arena/evidence-writeback-persistence';
import {
  isAuthoritativeConsumerRead,
  readAuthorizedCumulativePortrait,
  viewerForPortraitConsumer,
} from '@/features/learning-record/consumers/public-api';
import { isLearningFactEligibleForPersonalization } from '@/lib/data-governance/learning-fact-quality-weight';
import {
  readStudentEvidenceFeatures,
  type StudentEvidenceFeatureReadResult,
} from '@/lib/data-governance/student-evidence-feature-cache';
import {
  createEmptyCompetencyVector,
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: non-authoritative compatibility vector retained for legacy output only.
  type CompetencyVector,
} from '@/lib/data-governance/competency-model';
import type { PortraitV2Consumer } from '@/lib/data-governance/portrait-v2-consumer';

import { asRecord, readString, type AdaptiveLearnerStateDb, type PortraitResolution } from './internal';

const LEARNER_STATE_FACT_TAKE = 100;

export async function readEligibleLearnerStateFacts(
  db: AdaptiveLearnerStateDb,
  userId: string,
): Promise<Array<Record<string, unknown>>> {
  const findMany = db.learningFact?.findMany;
  if (!findMany) return [];

  const facts: Array<Record<string, unknown>> = [];
  let cursorId: string | null = null;
  while (facts.length < LEARNER_STATE_FACT_TAKE) {
    const rows = await findMany({
      where: { userId },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: LEARNER_STATE_FACT_TAKE,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    facts.push(...rows
      .filter((fact) => isLearningFactEligibleForPersonalization(fact.contextJson))
      .slice(0, LEARNER_STATE_FACT_TAKE - facts.length));

    const nextCursorId = readString(rows.at(-1)?.id);
    if (rows.length < LEARNER_STATE_FACT_TAKE || !nextCursorId || nextCursorId === cursorId) {
      break;
    }
    cursorId = nextCursorId;
  }

  return facts;
}
export async function resolveFencedAdaptivePortrait(
  db: AdaptiveLearnerStateDb,
  input: {
    userId: string;
    consumer: PortraitV2Consumer;
    now: Date;
    legacySnapshot: any;
  },
): Promise<PortraitResolution> {
  const currentRead = await readAuthorizedCumulativePortrait({
    db,
    viewer: viewerForPortraitConsumer(input.consumer, input.userId),
    targetUserId: input.userId,
    consumer: input.consumer,
  });
  const current = currentRead.portrait;
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: the legacy vector is retained only as non-authoritative compatibility output.
  const legacyVector = input.legacySnapshot?.competencyVector &&
    typeof input.legacySnapshot.competencyVector === 'object'
    ? input.legacySnapshot.competencyVector as CompetencyVector
    : createEmptyCompetencyVector();
  const authoritative = isAuthoritativeConsumerRead(currentRead);
  const primaryPortrait = authoritative && current.stateKind === 'SNAPSHOT' && current.payload
    ? current.payload
    : null;
  const primaryPortraitState = authoritative && current.stateKind === 'SNAPSHOT'
    ? 'SNAPSHOT' as const
    : currentRead.knownZero || current.stateKind === 'NO_EVIDENCE'
      ? 'NO_EVIDENCE' as const
      : 'UNAVAILABLE' as const;
  const primaryPortraitAvailability = authoritative && current.stateKind === 'SNAPSHOT'
    ? 'available'
    : currentRead.reason ?? current.availabilityReason;
  return {
    primaryPortrait,
    primaryPortraitState,
    primaryPortraitAvailability,
    // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: this source label documents non-authoritative legacy provenance.
    legacyCompatibility: {
      authority: 'legacy-compatibility-only' as const,
      source: input.legacySnapshot ? 'StudentCompetencySnapshot' as const : 'fallback-empty' as const,
      vector: legacyVector,
      snapshotId: typeof input.legacySnapshot?.id === 'string' ? input.legacySnapshot.id : null,
      snapshotAt: input.legacySnapshot?.snapshotAt instanceof Date
        ? input.legacySnapshot.snapshotAt.toISOString()
        : input.now.toISOString(),
    },
    limitations: authoritative && current.stateKind === 'SNAPSHOT'
      ? []
      : [
        `cumulative-portrait-${current.availabilityReason}`,
        ...(currentRead.reason && currentRead.reason !== current.availabilityReason
          ? [`projection-${currentRead.reason}`]
          : []),
      ],
  };
}

export async function readFeatureCache(
  db: AdaptiveLearnerStateDb,
  userId: string,
  now: Date,
): Promise<StudentEvidenceFeatureReadResult> {
  if (!db.studentEvidenceFeatureCache?.findUnique) {
    return {
      state: 'missing',
      cache: null,
      rawReadExceptions: ['audit', 'debug', 'drilldown', 'migration'],
    };
  }
  return readStudentEvidenceFeatures(db as Parameters<typeof readStudentEvidenceFeatures>[0], userId, { now });
}
export async function attachPersistedArenaWritebacks(
  db: AdaptiveLearnerStateDb,
  submissions: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  const submissionIds = submissions
    .map((submission) => readString(submission.id))
    .filter((id): id is string => Boolean(id));
  if (!submissionIds.length || typeof db.evidenceOutbox?.findMany !== 'function') {
    return submissions;
  }

  const writebacks = await readArenaSubmissionEvidenceWritebacks(db, submissionIds, 'service');
  if (writebacks.size === 0) return submissions;
  return submissions.map((submission) => {
    const id = readString(submission.id);
    const evidenceWriteback = id ? writebacks.get(id) : null;
    return evidenceWriteback ? { ...submission, evidenceWriteback } : submission;
  });
}
export async function readAdaptiveMasteryLearningFacts(
  db: AdaptiveLearnerStateDb,
  userId: string,
  masteryUpdates: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  if (!db.learningFact?.findMany) {
    return [];
  }

  const answerIds = latestMasteryAnswerIds(masteryUpdates);
  if (answerIds.length === 0) {
    return [];
  }

  const facts = await db.learningFact.findMany({
    where: {
      userId,
      sourceEventId: {
        in: answerIds.map((answerId) => `adaptive-assessment:${answerId}`),
      },
    },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
  });
  return facts.filter((fact) => isLearningFactEligibleForPersonalization(fact.contextJson));
}
function latestMasteryAnswerIds(rows: Array<Record<string, unknown>>): string[] {
  const seenKnowledgeTags = new Set<string>();
  const answerIds = new Set<string>();
  for (const row of rows) {
    const knowledgeTag = readString(row.knowledgeTag);
    if (!knowledgeTag || seenKnowledgeTags.has(knowledgeTag)) {
      continue;
    }
    seenKnowledgeTags.add(knowledgeTag);
    const answerId = readString(row.answerId);
    if (answerId) {
      answerIds.add(answerId);
    }
  }
  return [...answerIds];
}
