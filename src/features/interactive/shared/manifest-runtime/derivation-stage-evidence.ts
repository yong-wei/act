export const DERIVATION_STAGE_EVIDENCE_SCHEMA_VERSION = 'derivation-stage-evidence-v1';

export const DERIVATION_STAGE_DIAGNOSTIC_POLICY = {
  denominator: 'latest-attempt-per-student',
  dedupeKey: 'actorId:lessonKey:stepId:moduleId:attemptKey',
  attemptPolicy: 'latest-visible-with-resubmission-history',
  unreleasedStudentPolicy: 'include-as-unreleased-unvisited',
  freeTextPolicy: 'teacher-admin-redacted-summary-only',
  access: 'teacher-admin-only',
} as const;

export type DerivationStageEvidenceClassification =
  | 'InteractionLog'
  | 'StudentStepResponse'
  | 'LearningFact';

export type DerivationStageFeedback = {
  misconceptionTagIds: string[];
  studentFeedbackMode: 'none' | 'hint' | 'explanation' | 'retry';
  teacherNextPrompt: string | null;
  reviewAction: 'retry' | 'review' | 'advance' | 'none';
};

export type DerivationStageAnswer = {
  revealStepId: string;
  formulaBlockIds: string[];
  answerText: string;
  submittedAt: string;
  feedback?: DerivationStageFeedback;
};

export type DerivationStageEvidenceInput = {
  eventType: 'derivation_view' | 'derivation_reveal' | 'formula_focus' | 'derivation_answer' | 'derivation_feedback' | 'teacher_reveal';
  clientEventId: string;
  attemptKey: string;
  sourceLogId: string;
  lessonKey: string;
  stepId: string;
  moduleId: string;
  componentId: string;
  actorRole: 'student' | 'teacher' | 'admin' | 'guest';
  clientEventAt: string;
  theme: 'light' | 'dark';
  viewport: 'mobile' | 'desktop' | 'projection';
  stageId: string;
  activeRevealStepId: string;
  maxRevealStepSeen: number;
  visitedRevealStepIds: string[];
  formulaBlockFocusEvents: Array<{ formulaBlockId: string; revealStepId: string; focusedAt: string }>;
  activeHighlightIds: string[];
  answersByRevealStep: DerivationStageAnswer[];
  classification: DerivationStageEvidenceClassification[];
  serverRecordedAt?: string;
};

export type DerivationStageClientEvidenceDraftInput = Omit<
  DerivationStageEvidenceInput,
  'sourceLogId' | 'serverRecordedAt' | 'classification'
> & {
  classification?: DerivationStageEvidenceClassification[];
};

export type DerivationStageEvidenceSample = {
  eventType: DerivationStageEvidenceInput['eventType'];
  clientEventId: string;
  attemptKey: string;
  sourceLogId: string;
  lessonKey: string;
  stepId: string;
  moduleId: string;
  componentKind: 'visual.derivationStage';
  componentId: string;
  actorRole: DerivationStageEvidenceInput['actorRole'];
  clientEventAt: string;
  theme: DerivationStageEvidenceInput['theme'];
  viewport: DerivationStageEvidenceInput['viewport'];
  schemaVersion: typeof DERIVATION_STAGE_EVIDENCE_SCHEMA_VERSION;
  payload: {
    theme: DerivationStageEvidenceInput['theme'];
    viewport: DerivationStageEvidenceInput['viewport'];
    stageId: string;
    activeRevealStepId: string;
    maxRevealStepSeen: number;
    visitedRevealStepIds: string[];
    formulaBlockFocusEvents: DerivationStageEvidenceInput['formulaBlockFocusEvents'];
    activeHighlightIds: string[];
    answersByRevealStep: DerivationStageAnswer[];
    classification: DerivationStageEvidenceClassification[];
    serverRecordedAt: string | null;
  };
};

export type DerivationStageDiagnosticEvent = {
  actorId: string;
  actorRole: DerivationStageEvidenceInput['actorRole'];
  lessonKey: string;
  stepId: string;
  moduleId: string;
  viewed: boolean;
  released: boolean;
  visitedRevealStepIds: string[];
  maxRevealStepSeen: number;
  formulaBlockFocusIds: string[];
  answersByRevealStep: DerivationStageAnswer[];
  misconceptionTagIds: string[];
  attemptKey: string;
  clientEventId: string;
  clientEventAt?: string;
  serverRecordedAt?: string;
};

export type DerivationStageTeacherDiagnostics = {
  policy: typeof DERIVATION_STAGE_DIAGNOSTIC_POLICY;
  viewedCount: number;
  submittedCount: number;
  revealStepDistribution: Array<{ revealStepId: string; count: number }>;
  unvisitedRevealStepCount: number;
  formulaBlockFocusDistribution: Array<{ formulaBlockId: string; count: number }>;
  misconceptionsByRevealStep: Array<{ revealStepId: string; misconceptionTagId: string; count: number }>;
  latestAttemptKeys: string[];
};

export function buildDerivationStageEvidenceSample(
  input: DerivationStageEvidenceInput,
): DerivationStageEvidenceSample {
  return {
    eventType: input.eventType,
    clientEventId: input.clientEventId,
    attemptKey: input.attemptKey,
    sourceLogId: input.sourceLogId,
    lessonKey: input.lessonKey,
    stepId: input.stepId,
    moduleId: input.moduleId,
    componentKind: 'visual.derivationStage',
    componentId: input.componentId,
    actorRole: input.actorRole,
    clientEventAt: input.clientEventAt,
    theme: input.theme,
    viewport: input.viewport,
    schemaVersion: DERIVATION_STAGE_EVIDENCE_SCHEMA_VERSION,
    payload: {
      theme: input.theme,
      viewport: input.viewport,
      stageId: input.stageId,
      activeRevealStepId: input.activeRevealStepId,
      maxRevealStepSeen: input.maxRevealStepSeen,
      visitedRevealStepIds: [...input.visitedRevealStepIds],
      formulaBlockFocusEvents: input.formulaBlockFocusEvents.map((event) => ({ ...event })),
      activeHighlightIds: [...input.activeHighlightIds],
      answersByRevealStep: input.answersByRevealStep.map((answer) => ({
        ...answer,
        formulaBlockIds: [...answer.formulaBlockIds],
        feedback: answer.feedback ? {
          ...answer.feedback,
          misconceptionTagIds: [...answer.feedback.misconceptionTagIds],
        } : undefined,
      })),
      classification: validatedClassification(input.eventType, input.classification),
      serverRecordedAt: input.serverRecordedAt ?? null,
    },
  };
}

export function buildDerivationStageClientEvidenceDraft(
  input: DerivationStageClientEvidenceDraftInput,
): Omit<DerivationStageEvidenceSample, 'sourceLogId'> {
  const materialized = buildDerivationStageEvidenceSample({
    ...input,
    sourceLogId: '__server_fills_trusted_source_log_id__',
    classification: input.classification ?? defaultClassification(input.eventType),
  });
  const { sourceLogId: _serverOnlySourceLogId, ...draft } = materialized;
  return draft;
}

export function materializeDerivationStageEvidenceSample({
  draft,
  trustedSourceLogId,
  serverRecordedAt,
}: {
  draft: Omit<DerivationStageEvidenceSample, 'sourceLogId'>;
  trustedSourceLogId: string;
  serverRecordedAt: string;
}): DerivationStageEvidenceSample {
  return buildDerivationStageEvidenceSample({
    eventType: draft.eventType,
    clientEventId: draft.clientEventId,
    attemptKey: draft.attemptKey,
    sourceLogId: trustedSourceLogId,
    lessonKey: draft.lessonKey,
    stepId: draft.stepId,
    moduleId: draft.moduleId,
    componentId: draft.componentId,
    actorRole: draft.actorRole,
    clientEventAt: draft.clientEventAt,
    theme: draft.theme,
    viewport: draft.viewport,
    stageId: draft.payload.stageId,
    activeRevealStepId: draft.payload.activeRevealStepId,
    maxRevealStepSeen: draft.payload.maxRevealStepSeen,
    visitedRevealStepIds: draft.payload.visitedRevealStepIds,
    formulaBlockFocusEvents: draft.payload.formulaBlockFocusEvents,
    activeHighlightIds: draft.payload.activeHighlightIds,
    answersByRevealStep: draft.payload.answersByRevealStep,
    classification: draft.payload.classification,
    serverRecordedAt,
  });
}

export function buildDerivationStageTeacherDiagnostics(
  events: readonly DerivationStageDiagnosticEvent[],
  revealStepIds: readonly string[],
): DerivationStageTeacherDiagnostics {
  const latestByActor = new Map<string, DerivationStageDiagnosticEvent>();
  for (const event of events) {
    if (event.actorRole !== 'student') continue;
    const previous = latestByActor.get(event.actorId);
    if (!previous || compareDiagnosticEvents(previous, event) < 0) {
      latestByActor.set(event.actorId, event);
    }
  }
  const latestEvents = [...latestByActor.values()];
  const revealStepDistribution = sortedCounts(
    latestEvents.flatMap((event) => event.visitedRevealStepIds),
    'revealStepId',
    'count',
  );
  const formulaBlockFocusDistribution = sortedCounts(
    latestEvents.flatMap((event) => event.formulaBlockFocusIds),
    'formulaBlockId',
    'count',
  );
  const misconceptionsByRevealStep = sortedMisconceptions(latestEvents);
  return {
    policy: DERIVATION_STAGE_DIAGNOSTIC_POLICY,
    viewedCount: latestEvents.filter((event) => event.viewed).length,
    submittedCount: latestEvents.filter((event) => event.answersByRevealStep.length > 0).length,
    revealStepDistribution,
    unvisitedRevealStepCount: latestEvents.filter((event) => (
      revealStepIds.some((revealStepId) => !event.visitedRevealStepIds.includes(revealStepId))
    )).length,
    formulaBlockFocusDistribution,
    misconceptionsByRevealStep,
    latestAttemptKeys: latestEvents.map((event) => event.attemptKey).sort(),
  };
}

function compareDiagnosticEvents(left: DerivationStageDiagnosticEvent, right: DerivationStageDiagnosticEvent): number {
  const leftTime = Date.parse(left.serverRecordedAt ?? left.clientEventAt ?? '');
  const rightTime = Date.parse(right.serverRecordedAt ?? right.clientEventAt ?? '');
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime;
  return left.clientEventId.localeCompare(right.clientEventId);
}

function validatedClassification(
  eventType: DerivationStageEvidenceInput['eventType'],
  classification: DerivationStageEvidenceClassification[],
): DerivationStageEvidenceClassification[] {
  if (
    (eventType === 'derivation_view' || eventType === 'formula_focus' || eventType === 'derivation_reveal' || eventType === 'teacher_reveal')
    && classification.includes('LearningFact')
  ) {
    throw new Error(`${eventType} evidence cannot be classified as LearningFact without a response or scoring rule`);
  }
  if ((eventType === 'derivation_answer' || eventType === 'derivation_feedback') && !classification.includes('StudentStepResponse')) {
    throw new Error(`${eventType} evidence must include StudentStepResponse classification`);
  }
  return [...new Set(classification)];
}

function defaultClassification(
  eventType: DerivationStageEvidenceInput['eventType'],
): DerivationStageEvidenceClassification[] {
  if (eventType === 'derivation_answer' || eventType === 'derivation_feedback') {
    return ['InteractionLog', 'StudentStepResponse'];
  }
  return ['InteractionLog'];
}

function sortedCounts<
  TKey extends string,
  TValue extends string,
>(items: readonly string[], keyName: TKey, valueName: TValue): Array<Record<TKey, string> & Record<TValue, number>> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.trim()) continue;
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([leftKey, leftCount], [rightKey, rightCount]) => rightCount - leftCount || leftKey.localeCompare(rightKey))
    .map(([key, count]) => ({ [keyName]: key, [valueName]: count }) as Record<TKey, string> & Record<TValue, number>);
}

function sortedMisconceptions(events: readonly DerivationStageDiagnosticEvent[]) {
  const counts = new Map<string, { revealStepId: string; misconceptionTagId: string; count: number }>();
  for (const event of events) {
    for (const answer of event.answersByRevealStep) {
      for (const tagId of answer.feedback?.misconceptionTagIds ?? event.misconceptionTagIds) {
        const key = `${answer.revealStepId}:${tagId}`;
        const existing = counts.get(key);
        counts.set(key, {
          revealStepId: answer.revealStepId,
          misconceptionTagId: tagId,
          count: (existing?.count ?? 0) + 1,
        });
      }
    }
  }
  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.revealStepId.localeCompare(right.revealStepId) || left.misconceptionTagId.localeCompare(right.misconceptionTagId));
}
