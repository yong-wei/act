import { createHash } from 'node:crypto';

import {
  writeKnowledgeScopedLearningFacts,
  type LearningFactSink,
} from '@/lib/canonical-learning-fact-identity';
import { resolveActiveKnowledgeRevision } from '@/lib/data-governance/knowledge-truth-revision';
import {
  projectionPinsFromSelection,
  resolveLearningPathProductionSelection,
} from '@/lib/versioned-knowledge-activation';
import {
  MICRO_INTERVENTION_EVIDENCE_ALGORITHM_VERSION,
  MICRO_INTERVENTION_PUBLIC_MIN_LEARNERS,
  MICRO_INTERVENTION_VALIDATION_WEIGHT_CAP,
  decayedValidationWeight,
  isMicroInterventionEvidenceConsumerEnabled,
  isRepeatWithinWindow,
  type MicroInterventionEvidenceKind,
  type MicroInterventionEvidenceLimitation,
} from './micro-intervention-evidence-policy';

export interface MicroInterventionEvidenceIdentity {
  canonicalObjectId: string;
  aggregateReleaseSetId: string;
  aggregateReleaseId: string;
  knowledgeProjectionId: string;
  captureRevision: string;
  courseId?: string;
  resourceScopeId?: string;
}

export interface SealedMicroInterventionOutcome {
  id: string;
  userId: string;
  learnerSessionId: string;
  startedAt: Date;
  sourceSnapshot: {
    task: {
      goal: string;
      sourceQuestionId: string;
      knowledgeNodeId: string;
      misconceptionTag: string;
      validationQuestion: {
        itemRefId: string;
        questionId: string;
        contentHash: string;
        version: string;
      };
    };
  };
  events: Array<{
    id: string;
    eventType: string;
    occurredAt: Date;
  }>;
  validation: {
    id: string;
    isCorrect: boolean;
    submittedAt: Date;
    questionId: string;
    questionContentHash: string;
    questionVersion: string;
  } | null;
}

export interface MicroInterventionEvidenceEnvelope {
  evidenceId: string;
  kind: MicroInterventionEvidenceKind;
  algorithmVersion: string;
  interventionId: string;
  learnerSessionId: string;
  learningGoalId: string;
  canonicalNodeId: string;
  sourceQuestionId: string;
  validationItemId: string | null;
  validationContentHash: string | null;
  validationVersion: string | null;
  isCorrect: boolean | null;
  occurredAt: string;
  identity: MicroInterventionEvidenceIdentity;
  limitations: MicroInterventionEvidenceLimitation[];
}

interface EvidenceOutboxDelegate {
  upsert(args: {
    where: { dedupeKey: string };
    update: { payload?: unknown; status?: string };
    create: {
      eventType: string;
      correlationId: string;
      causationId: string;
      ownerUserId: string;
      payload: unknown;
      dedupeKey: string;
      status: string;
    };
  }): Promise<{ id: string; status: string; payload: unknown; dedupeKey: string }>;
  findMany(args: { where: { eventType: string; ownerUserId?: string } }): Promise<Array<{
    id: string;
    ownerUserId: string;
    payload: unknown;
    status: string;
    dedupeKey: string;
  }>>;
}

export interface MicroInterventionEvidenceDb extends LearningFactSink {
  evidenceOutbox: EvidenceOutboxDelegate;
  learningFact: LearningFactSink['learningFact'] & {
    updateMany?(args: {
      where: { sourceEventId: string };
      data: { contextJson: unknown };
    }): Promise<{ count: number }>;
  };
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function identityComplete(identity: MicroInterventionEvidenceIdentity | null): identity is MicroInterventionEvidenceIdentity {
  return Boolean(
    identity
    && nonEmpty(identity.canonicalObjectId)
    && nonEmpty(identity.aggregateReleaseSetId)
    && nonEmpty(identity.aggregateReleaseId)
    && nonEmpty(identity.knowledgeProjectionId)
    && nonEmpty(identity.captureRevision)
    && !identity.aggregateReleaseSetId.includes('candidate'),
  );
}

function evidenceId(parts: string[]): string {
  return createHash('sha256').update(parts.join(':')).digest('hex');
}

export async function resolveMicroInterventionEvidenceIdentity(
  outcome: SealedMicroInterventionOutcome,
): Promise<MicroInterventionEvidenceIdentity | null> {
  const nodeId = nonEmpty(outcome.sourceSnapshot?.task?.knowledgeNodeId);
  if (!nodeId) return null;
  const selection = resolveLearningPathProductionSelection();
  const pins = projectionPinsFromSelection(selection);
  const revision = await resolveActiveKnowledgeRevision();
  const aggregateReleaseId = nonEmpty(pins.authorityReleaseId);
  const knowledgeProjectionId = nonEmpty(pins.projectionId);
  const captureRevision = nonEmpty(selection.combination?.captureRevision) ?? revision.id;
  const aggregateReleaseSetId = nonEmpty(pins.authoritySnapshotId) ?? aggregateReleaseId;
  if (!aggregateReleaseId || !knowledgeProjectionId || !captureRevision || !aggregateReleaseSetId) {
    return null;
  }
  if (aggregateReleaseSetId.includes('candidate') || aggregateReleaseId.includes('candidate')) {
    return null;
  }
  return {
    canonicalObjectId: nodeId,
    aggregateReleaseSetId,
    aggregateReleaseId,
    knowledgeProjectionId,
    captureRevision,
    courseId: nonEmpty(selection.combination?.scopeId) ?? undefined,
  };
}

export function readSealedMicroInterventionProjectionSource(
  outcome: SealedMicroInterventionOutcome,
  identity: MicroInterventionEvidenceIdentity | null,
): {
  envelopes: MicroInterventionEvidenceEnvelope[];
  limitations: MicroInterventionEvidenceLimitation[];
} {
  const task = outcome.sourceSnapshot?.task;
  const limitations: MicroInterventionEvidenceLimitation[] = [];
  if (!identityComplete(identity)) {
    return { envelopes: [], limitations: ['identity-incomplete'] };
  }
  if (
    !nonEmpty(task?.goal)
    || !nonEmpty(task?.knowledgeNodeId)
    || !nonEmpty(task?.sourceQuestionId)
  ) {
    return { envelopes: [], limitations: ['identity-drift'] };
  }

  const base = {
    algorithmVersion: MICRO_INTERVENTION_EVIDENCE_ALGORITHM_VERSION,
    interventionId: outcome.id,
    learnerSessionId: outcome.learnerSessionId,
    learningGoalId: task.goal,
    canonicalNodeId: task.knowledgeNodeId,
    sourceQuestionId: task.sourceQuestionId,
    identity,
  };

  const envelopes: MicroInterventionEvidenceEnvelope[] = outcome.events.map((event) => ({
    ...base,
    evidenceId: evidenceId([
      MICRO_INTERVENTION_EVIDENCE_ALGORITHM_VERSION,
      outcome.id,
      'context',
      event.id,
    ]),
    kind: 'context-participation',
    validationItemId: null,
    validationContentHash: null,
    validationVersion: null,
    isCorrect: null,
    occurredAt: event.occurredAt.toISOString(),
    limitations: ['not-terminal-mastery'],
  }));

  if (outcome.validation) {
    if (
      outcome.validation.questionId !== task.validationQuestion.questionId
      || outcome.validation.questionContentHash !== task.validationQuestion.contentHash
      || outcome.validation.questionVersion !== task.validationQuestion.version
    ) {
      limitations.push('identity-drift');
    } else {
      envelopes.push({
        ...base,
        evidenceId: evidenceId([
          MICRO_INTERVENTION_EVIDENCE_ALGORITHM_VERSION,
          outcome.id,
          'validation',
          outcome.validation.id,
        ]),
        kind: 'independent-validation',
        validationItemId: task.validationQuestion.itemRefId,
        validationContentHash: task.validationQuestion.contentHash,
        validationVersion: task.validationQuestion.version,
        isCorrect: outcome.validation.isCorrect,
        occurredAt: outcome.validation.submittedAt.toISOString(),
        limitations: ['not-terminal-mastery'],
      });
    }
  }

  return { envelopes, limitations };
}

function publicEnvelope(envelope: MicroInterventionEvidenceEnvelope) {
  return {
    evidenceId: envelope.evidenceId,
    kind: envelope.kind,
    algorithmVersion: envelope.algorithmVersion,
    learningGoalId: envelope.learningGoalId,
    canonicalNodeId: envelope.canonicalNodeId,
    validationItemId: envelope.validationItemId,
    validationContentHash: envelope.validationContentHash,
    validationVersion: envelope.validationVersion,
    isCorrect: envelope.isCorrect,
    occurredAt: envelope.occurredAt,
    captureRevision: envelope.identity.captureRevision,
    limitations: envelope.limitations,
  };
}

export async function scheduleMicroInterventionEvidenceProjection(input: {
  db: MicroInterventionEvidenceDb & {
    microInterventionOutcome: {
      findFirst(args: {
        where: { id: string };
        include: { events: true; validation: true };
      }): Promise<SealedMicroInterventionOutcome | null>;
    };
  };
  interventionId: string;
  identity?: MicroInterventionEvidenceIdentity | null;
}): Promise<void> {
  const outcome = await input.db.microInterventionOutcome.findFirst({
    where: { id: input.interventionId },
    include: { events: true, validation: true },
  });
  if (!outcome) return;
  await projectMicroInterventionOutcome({
    db: input.db,
    outcome,
    identity: input.identity === undefined
      ? await resolveMicroInterventionEvidenceIdentity(outcome)
      : input.identity,
  });
}

export async function projectMicroInterventionOutcome(input: {
  db: MicroInterventionEvidenceDb;
  outcome: SealedMicroInterventionOutcome;
  identity: MicroInterventionEvidenceIdentity | null;
  consume?: boolean;
}): Promise<{
  projected: MicroInterventionEvidenceEnvelope[];
  limitations: MicroInterventionEvidenceLimitation[];
  writtenFacts: number;
}> {
  const source = readSealedMicroInterventionProjectionSource(input.outcome, input.identity);
  if (source.envelopes.length === 0) {
    await persistOutbox(input.db, {
      evidenceId: evidenceId([
        MICRO_INTERVENTION_EVIDENCE_ALGORITHM_VERSION,
        input.outcome.id,
        'drift',
      ]),
      kind: 'context-participation',
      algorithmVersion: MICRO_INTERVENTION_EVIDENCE_ALGORITHM_VERSION,
      interventionId: input.outcome.id,
      learnerSessionId: input.outcome.learnerSessionId,
      learningGoalId: '',
      canonicalNodeId: '',
      sourceQuestionId: '',
      validationItemId: null,
      validationContentHash: null,
      validationVersion: null,
      isCorrect: null,
      occurredAt: input.outcome.startedAt.toISOString(),
      identity: input.identity ?? {
        canonicalObjectId: '',
        aggregateReleaseSetId: '',
        aggregateReleaseId: '',
        knowledgeProjectionId: '',
        captureRevision: '',
      },
      limitations: source.limitations,
    }, input.outcome.userId, 'drift');
    return { projected: [], limitations: source.limitations, writtenFacts: 0 };
  }

  const consume = input.consume ?? isMicroInterventionEvidenceConsumerEnabled();
  const revision = await resolveActiveKnowledgeRevision();
  let writtenFacts = 0;
  for (const envelope of source.envelopes) {
    const status = envelope.kind === 'independent-validation' && !consume ? 'shadow' : 'projected';
    await persistOutbox(input.db, envelope, input.outcome.userId, status);
    const sourceEventId = `micro-intervention:${envelope.evidenceId}`;
    const contextJson = {
      knowledgeRevisionRef: revision.id,
      evidenceGovernance: {
        evidenceQuality: envelope.kind === 'independent-validation' ? 'partial' : 'missing',
        profileWeight: envelope.kind === 'independent-validation' && consume
          ? MICRO_INTERVENTION_VALIDATION_WEIGHT_CAP
          : 0,
        skipProfileContribution: envelope.kind !== 'independent-validation' || !consume,
        policyReason: envelope.kind === 'independent-validation'
          ? consume ? 'micro_intervention_validation_bounded' : 'micro_intervention_validation_shadow'
          : 'micro_intervention_context_only',
        knowledgeRevisionRef: revision.id,
      },
      microInterventionEvidence: publicEnvelope(envelope),
    };
    const rows = [{
      userId: input.outcome.userId,
      factType: envelope.kind === 'independent-validation'
        ? 'micro_intervention_validation'
        : 'micro_intervention_context',
      sessionId: envelope.learnerSessionId,
      startedAt: new Date(envelope.occurredAt),
      finishedAt: new Date(envelope.occurredAt),
      outcome: envelope.isCorrect === true ? 'success' : envelope.isCorrect === false ? 'failure' : 'partial',
      score: envelope.isCorrect === true ? 1 : envelope.isCorrect === false ? 0 : null,
      competencyContribution: {},
      sourceEventId,
      courseId: envelope.identity.courseId ?? null,
      contextJson,
    }];
    const written = await writeKnowledgeScopedLearningFacts(
      input.db,
      { rows, knowledgeScoped: true },
      { knowledgeRevisionRef: revision.id },
    );
    writtenFacts += written.written;
    if (
      written.written === 0
      && consume
      && envelope.kind === 'independent-validation'
      && typeof input.db.learningFact.updateMany === 'function'
    ) {
      await input.db.learningFact.updateMany({
        where: { sourceEventId },
        data: { contextJson },
      });
    }
  }
  return { projected: source.envelopes, limitations: source.limitations, writtenFacts };
}

async function persistOutbox(
  db: MicroInterventionEvidenceDb,
  envelope: MicroInterventionEvidenceEnvelope,
  ownerUserId: string,
  status: string,
) {
  await db.evidenceOutbox.upsert({
    where: { dedupeKey: envelope.evidenceId },
    update: {
      payload: publicEnvelope(envelope),
      status,
    },
    create: {
      eventType: 'micro-intervention-evidence',
      correlationId: envelope.interventionId,
      causationId: envelope.evidenceId,
      ownerUserId,
      payload: publicEnvelope(envelope),
      dedupeKey: envelope.evidenceId,
      status,
    },
  });
}

export interface MicroInterventionPathEvidenceSummary {
  algorithmVersion: string;
  canonicalNodeId: string;
  confidence: number;
  freshness: 'current' | 'stale';
  quality: 'bounded-validation' | 'context-only' | 'limited';
  passCount: number;
  failCount: number;
  limitations: MicroInterventionEvidenceLimitation[];
}

export function summarizeMicroInterventionEvidenceForPath(
  envelopes: MicroInterventionEvidenceEnvelope[],
  now = new Date(),
): MicroInterventionPathEvidenceSummary | null {
  const validations = envelopes
    .filter((envelope) => envelope.kind === 'independent-validation')
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  if (validations.length === 0) {
    return envelopes.length > 0
      ? {
        algorithmVersion: MICRO_INTERVENTION_EVIDENCE_ALGORITHM_VERSION,
        canonicalNodeId: envelopes[0].canonicalNodeId,
        confidence: 0,
        freshness: 'current',
        quality: 'context-only',
        passCount: 0,
        failCount: 0,
        limitations: ['not-terminal-mastery', 'consumer-shadow-only'],
      }
      : null;
  }

  const limitations = new Set<MicroInterventionEvidenceLimitation>(['not-terminal-mastery']);
  let weightedPasses = 0;
  let weightedFails = 0;
  validations.forEach((envelope, index) => {
    const occurredAt = new Date(envelope.occurredAt);
    let weight = decayedValidationWeight(occurredAt, now);
    if (index > 0 && isRepeatWithinWindow(new Date(validations[index - 1].occurredAt), occurredAt)) {
      weight = 0;
      limitations.add('repeat-suppressed');
    }
    if (weight < MICRO_INTERVENTION_VALIDATION_WEIGHT_CAP) limitations.add('time-decayed');
    if (envelope.isCorrect) weightedPasses += weight;
    else weightedFails += weight;
  });
  if (validations.some((envelope) => envelope.isCorrect) && validations.some((envelope) => envelope.isCorrect === false)) {
    limitations.add('conflict');
  }
  const latest = validations[validations.length - 1];
  const confidence = Math.min(
    MICRO_INTERVENTION_VALIDATION_WEIGHT_CAP,
    Math.max(0, weightedPasses - weightedFails),
  );
  return {
    algorithmVersion: MICRO_INTERVENTION_EVIDENCE_ALGORITHM_VERSION,
    canonicalNodeId: latest.canonicalNodeId,
    confidence,
    freshness: limitations.has('time-decayed') ? 'stale' : 'current',
    quality: limitations.has('conflict') ? 'limited' : 'bounded-validation',
    passCount: validations.filter((envelope) => envelope.isCorrect).length,
    failCount: validations.filter((envelope) => envelope.isCorrect === false).length,
    limitations: [...limitations],
  };
}

export function applyMicroInterventionEvidenceSummaryToPathPlan<T extends {
  masteredCanonicalIds?: string[];
  limitations?: string[];
}>(
  plan: T,
  summary: MicroInterventionPathEvidenceSummary | null,
  options: { consume?: boolean } = {},
): T {
  if (!summary) return plan;
  const consume = options.consume ?? isMicroInterventionEvidenceConsumerEnabled();
  const limitations = new Set(plan.limitations ?? []);
  limitations.add(`micro-intervention:${summary.quality}`);
  for (const limitation of summary.limitations) limitations.add(`micro-intervention:${limitation}`);
  if (!consume || summary.confidence < 0.2 || summary.quality !== 'bounded-validation') {
    limitations.add('micro-intervention:hold-assessment-gates');
  }
  return {
    ...plan,
    limitations: [...limitations],
  };
}

export function buildPublicMicroInterventionEvidenceReport(rows: Array<{
  ownerUserId: string;
  payload: { isCorrect?: boolean | null; kind?: string; canonicalNodeId?: string };
}>): {
  suppressed: boolean;
  learnerCount: number;
  validationCount: number;
  passCount: number;
  nodeCount: number;
} {
  const validations = rows.filter((row) => row.payload.kind === 'independent-validation');
  const learners = new Set(validations.map((row) => row.ownerUserId));
  if (learners.size < MICRO_INTERVENTION_PUBLIC_MIN_LEARNERS) {
    return {
      suppressed: true,
      learnerCount: 0,
      validationCount: 0,
      passCount: 0,
      nodeCount: 0,
    };
  }
  return {
    suppressed: false,
    learnerCount: learners.size,
    validationCount: validations.length,
    passCount: validations.filter((row) => row.payload.isCorrect === true).length,
    nodeCount: new Set(validations.map((row) => row.payload.canonicalNodeId).filter(Boolean)).size,
  };
}
