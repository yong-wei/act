export const ANNOTATED_MEDIA_EVIDENCE_SCHEMA_VERSION = 'annotated-media-evidence-v1';

export const ANNOTATED_MEDIA_DIAGNOSTIC_POLICY = {
  denominator: 'latest-attempt-per-student',
  dedupeKey: 'actorId:lessonKey:stepId:moduleId:attemptKey',
  attemptPolicy: 'latest-visible-media-state-with-resubmission-history',
  resubmissionDisplay: 'latest-with-history-count',
  unreleasedStudentInclusion: 'include-as-unreleased-unvisited',
  freeTextRedaction: 'redact-by-default',
  access: 'teacher-admin-only',
  labelsUseTeachingSemantics: true,
} as const;

export type AnnotatedMediaComponentKind = 'visual.annotatedMedia' | 'visual.embedded-activity';
export type AnnotatedMediaEvidenceClassification = 'InteractionLog' | 'StudentStepResponse' | 'LearningFact';
export type AnnotatedMediaActorRole = 'student' | 'teacher' | 'admin' | 'guest';

export type AnnotatedMediaFeedback = {
  misconceptionTagIds: string[];
  studentFeedbackMode: 'none' | 'hint' | 'explanation' | 'retry';
  teacherNextPrompt: string | null;
  reviewAction: 'retry' | 'review' | 'advance' | 'none';
};

export type AnnotatedMediaEvidenceInput = {
  eventType: 'hotspot_view' | 'hotspot_select' | 'activity_answer' | 'media_submit' | 'teacher_reveal' | 'feedback';
  clientEventId: string;
  attemptKey: string;
  sourceLogId: string;
  lessonKey: string;
  stepId: string;
  moduleId: string;
  componentKind: AnnotatedMediaComponentKind;
  componentId: string;
  actorRole: AnnotatedMediaActorRole;
  clientEventAt: string;
  mediaId: string;
  activeRevealState: string;
  selectedAnnotationIds: string[];
  omittedRequiredAnnotationIds: string[];
  evidenceRoles: Record<string, string>;
  embeddedActivityAnchorId: string | null;
  answerPayload: Record<string, unknown> | null;
  teachingLabels: Record<string, string>;
  feedback?: AnnotatedMediaFeedback;
  classification: AnnotatedMediaEvidenceClassification[];
  serverRecordedAt?: string;
};

export type AnnotatedMediaClientEvidenceDraftInput = Omit<
  AnnotatedMediaEvidenceInput,
  'sourceLogId' | 'serverRecordedAt' | 'classification'
> & {
  classification?: AnnotatedMediaEvidenceClassification[];
};

export type AnnotatedMediaEvidenceSample = {
  eventType: AnnotatedMediaEvidenceInput['eventType'];
  clientEventId: string;
  attemptKey: string;
  sourceLogId: string;
  lessonKey: string;
  stepId: string;
  moduleId: string;
  componentKind: AnnotatedMediaComponentKind;
  componentId: string;
  actorRole: AnnotatedMediaActorRole;
  clientEventAt: string;
  schemaVersion: typeof ANNOTATED_MEDIA_EVIDENCE_SCHEMA_VERSION;
  serverRecordedAt: string | null;
  classification: AnnotatedMediaEvidenceClassification[];
  affectsTeacherDiagnostics: boolean;
  affectsAbilitySnapshots: boolean;
  affectsRecommendationInputs: boolean;
  payload: {
    mediaId: string;
    activeRevealState: string;
    selectedAnnotationIds: string[];
    omittedRequiredAnnotationIds: string[];
    evidenceRoles: Record<string, string>;
    embeddedActivityAnchorId: string | null;
    answerPayload: Record<string, unknown> | null;
    teachingLabels: Record<string, string>;
    feedback: AnnotatedMediaFeedback | null;
    classification: AnnotatedMediaEvidenceClassification[];
    serverRecordedAt: string | null;
  };
};

export type AnnotatedMediaDiagnosticEvent = {
  actorId: string;
  actorRole: AnnotatedMediaActorRole;
  lessonKey: string;
  stepId: string;
  moduleId: string;
  mediaId: string;
  viewed: boolean;
  submitted: boolean;
  activeRevealState: string;
  selectedAnnotationIds: string[];
  omittedRequiredAnnotationIds: string[];
  evidenceRoles: Record<string, string>;
  teachingLabels: Record<string, string>;
  misconceptionTagIds: string[];
  attemptKey: string;
  clientEventId: string;
  clientEventAt?: string;
  serverRecordedAt?: string;
};

export type AnnotatedMediaTeacherDiagnostics = {
  policy: typeof ANNOTATED_MEDIA_DIAGNOSTIC_POLICY;
  viewedCount: number;
  submittedCount: number;
  selectedAnnotationDistribution: Array<{ annotationId: string; label: string; count: number }>;
  omittedRequiredAnnotationDistribution: Array<{ annotationId: string; label: string; count: number }>;
  evidenceRoleConfusionDistribution: Array<{ evidenceRole: string; label: string; count: number }>;
  misconceptionDistribution: Array<{ misconceptionTagId: string; count: number }>;
  latestAttemptKeys: string[];
};

export function canViewAnnotatedMediaTeacherDiagnostics(actorRole: AnnotatedMediaActorRole) {
  return actorRole === 'teacher' || actorRole === 'admin';
}

export function buildAnnotatedMediaEvidenceSample(input: AnnotatedMediaEvidenceInput): AnnotatedMediaEvidenceSample {
  const classification = validatedClassification(input.eventType, input.classification);
  const serverRecordedAt = input.serverRecordedAt ?? null;
  return {
    eventType: input.eventType,
    clientEventId: input.clientEventId,
    attemptKey: input.attemptKey,
    sourceLogId: input.sourceLogId,
    lessonKey: input.lessonKey,
    stepId: input.stepId,
    moduleId: input.moduleId,
    componentKind: input.componentKind,
    componentId: input.componentId,
    actorRole: input.actorRole,
    clientEventAt: input.clientEventAt,
    schemaVersion: ANNOTATED_MEDIA_EVIDENCE_SCHEMA_VERSION,
    serverRecordedAt,
    classification,
    affectsTeacherDiagnostics: true,
    affectsAbilitySnapshots: classification.includes('LearningFact'),
    affectsRecommendationInputs: classification.includes('LearningFact'),
    payload: {
      mediaId: input.mediaId,
      activeRevealState: input.activeRevealState,
      selectedAnnotationIds: [...input.selectedAnnotationIds],
      omittedRequiredAnnotationIds: [...input.omittedRequiredAnnotationIds],
      evidenceRoles: { ...input.evidenceRoles },
      embeddedActivityAnchorId: input.embeddedActivityAnchorId,
      answerPayload: input.answerPayload ? { ...input.answerPayload } : null,
      teachingLabels: { ...input.teachingLabels },
      feedback: input.feedback ? {
        ...input.feedback,
        misconceptionTagIds: [...input.feedback.misconceptionTagIds],
      } : null,
      classification,
      serverRecordedAt,
    },
  };
}

export function buildAnnotatedMediaClientEvidenceDraft(
  input: AnnotatedMediaClientEvidenceDraftInput,
): Omit<AnnotatedMediaEvidenceSample, 'sourceLogId'> {
  const materialized = buildAnnotatedMediaEvidenceSample({
    ...input,
    sourceLogId: '__server_fills_trusted_source_log_id__',
    classification: input.classification ?? defaultClassification(input.eventType),
  });
  const { sourceLogId: _serverOnlySourceLogId, ...draft } = materialized;
  return draft;
}

export function materializeAnnotatedMediaEvidenceSample({
  draft,
  trustedSourceLogId,
  serverRecordedAt,
}: {
  draft: Omit<AnnotatedMediaEvidenceSample, 'sourceLogId'>;
  trustedSourceLogId: string;
  serverRecordedAt: string;
}): AnnotatedMediaEvidenceSample {
  return buildAnnotatedMediaEvidenceSample({
    eventType: draft.eventType,
    clientEventId: draft.clientEventId,
    attemptKey: draft.attemptKey,
    sourceLogId: trustedSourceLogId,
    lessonKey: draft.lessonKey,
    stepId: draft.stepId,
    moduleId: draft.moduleId,
    componentKind: draft.componentKind,
    componentId: draft.componentId,
    actorRole: draft.actorRole,
    clientEventAt: draft.clientEventAt,
    mediaId: draft.payload.mediaId,
    activeRevealState: draft.payload.activeRevealState,
    selectedAnnotationIds: draft.payload.selectedAnnotationIds,
    omittedRequiredAnnotationIds: draft.payload.omittedRequiredAnnotationIds,
    evidenceRoles: draft.payload.evidenceRoles,
    embeddedActivityAnchorId: draft.payload.embeddedActivityAnchorId,
    answerPayload: draft.payload.answerPayload,
    teachingLabels: draft.payload.teachingLabels,
    feedback: draft.payload.feedback ?? undefined,
    classification: draft.payload.classification,
    serverRecordedAt,
  });
}

export function materializeAnnotatedMediaEvidenceFromSubmissionPayload(
  payload: Record<string, unknown>,
  {
    trustedSourceLogId,
    serverRecordedAt,
  }: {
    trustedSourceLogId: string;
    serverRecordedAt: string;
  },
): AnnotatedMediaEvidenceSample | null {
  const draft = findAnnotatedMediaEvidenceDraft(payload);
  if (!draft) return null;
  return materializeAnnotatedMediaEvidenceSample({
    draft,
    trustedSourceLogId,
    serverRecordedAt,
  });
}

export function annotatedMediaDiagnosticEventFromEvidence(
  actorId: string,
  evidence: unknown,
): AnnotatedMediaDiagnosticEvent | null {
  const record = recordValue(evidence);
  const payload = recordValue(record?.payload);
  if (!record || !payload) return null;
  const eventType = stringValue(record.eventType);
  const mediaId = stringValue(payload.mediaId);
  if (!eventType || !mediaId) return null;
  const actorRole = stringValue(record.actorRole);
  if (actorRole !== 'student') return null;
  return {
    actorId,
    actorRole: 'student',
    lessonKey: stringValue(record.lessonKey) ?? '',
    stepId: stringValue(record.stepId) ?? '',
    moduleId: stringValue(record.moduleId) ?? '',
    mediaId,
    viewed: true,
    submitted: eventType === 'media_submit' || eventType === 'activity_answer' || eventType === 'feedback',
    activeRevealState: stringValue(payload.activeRevealState) ?? '',
    selectedAnnotationIds: stringArrayValue(payload.selectedAnnotationIds),
    omittedRequiredAnnotationIds: stringArrayValue(payload.omittedRequiredAnnotationIds),
    evidenceRoles: stringRecordValue(payload.evidenceRoles),
    teachingLabels: stringRecordValue(payload.teachingLabels),
    misconceptionTagIds: stringArrayValue(recordValue(payload.feedback)?.misconceptionTagIds),
    attemptKey: stringValue(record.attemptKey) ?? '',
    clientEventId: stringValue(record.clientEventId) ?? '',
    clientEventAt: stringValue(record.clientEventAt) ?? undefined,
    serverRecordedAt: stringValue(payload.serverRecordedAt) ?? stringValue(record.serverRecordedAt) ?? undefined,
  };
}

export function buildAnnotatedMediaTeacherDiagnostics(
  events: readonly AnnotatedMediaDiagnosticEvent[],
): AnnotatedMediaTeacherDiagnostics {
  const latestByKey = new Map<string, AnnotatedMediaDiagnosticEvent>();
  for (const event of events) {
    if (event.actorRole !== 'student') continue;
    const key = [event.actorId, event.lessonKey, event.stepId, event.moduleId, event.attemptKey].join(':');
    const previous = latestByKey.get(key);
    if (!previous || compareDiagnosticEvents(previous, event) < 0) latestByKey.set(key, event);
  }
  const latestEvents = [...latestByKey.values()];
  const labelMap = Object.assign({}, ...latestEvents.map((event) => event.teachingLabels));
  return {
    policy: ANNOTATED_MEDIA_DIAGNOSTIC_POLICY,
    viewedCount: latestEvents.filter((event) => event.viewed).length,
    submittedCount: latestEvents.filter((event) => event.submitted).length,
    selectedAnnotationDistribution: sortedCountsWithLabels(
      latestEvents.flatMap((event) => event.selectedAnnotationIds),
      'annotationId',
      labelMap,
    ),
    omittedRequiredAnnotationDistribution: sortedCountsWithLabels(
      latestEvents.flatMap((event) => event.omittedRequiredAnnotationIds),
      'annotationId',
      labelMap,
    ),
    evidenceRoleConfusionDistribution: sortedCountsWithLabels(
      latestEvents.flatMap((event) => Object.values(event.evidenceRoles)),
      'evidenceRole',
      {},
    ),
    misconceptionDistribution: sortedMisconceptions(latestEvents),
    latestAttemptKeys: latestEvents.map((event) => event.attemptKey).sort(),
  };
}

function validatedClassification(
  eventType: AnnotatedMediaEvidenceInput['eventType'],
  classification: AnnotatedMediaEvidenceClassification[],
): AnnotatedMediaEvidenceClassification[] {
  if ((eventType === 'hotspot_view' || eventType === 'hotspot_select' || eventType === 'teacher_reveal') && classification.includes('LearningFact')) {
    throw new Error(`${eventType} evidence cannot be classified as LearningFact without a response or scoring rule`);
  }
  if ((eventType === 'activity_answer' || eventType === 'media_submit' || eventType === 'feedback') && !classification.includes('StudentStepResponse')) {
    throw new Error(`${eventType} evidence must include StudentStepResponse classification`);
  }
  return [...new Set(classification)];
}

function defaultClassification(eventType: AnnotatedMediaEvidenceInput['eventType']): AnnotatedMediaEvidenceClassification[] {
  if (eventType === 'activity_answer' || eventType === 'media_submit' || eventType === 'feedback') {
    return ['InteractionLog', 'StudentStepResponse'];
  }
  return ['InteractionLog'];
}

function findAnnotatedMediaEvidenceDraft(
  payload: Record<string, unknown>,
): Omit<AnnotatedMediaEvidenceSample, 'sourceLogId'> | null {
  const directDraft = parseAnnotatedMediaEvidenceDraft(payload.annotatedMediaEvidenceDraft);
  if (directDraft) return directDraft;

  const answerDigest = recordValue(payload.answerDigest ?? payload.answers) ?? {};
  for (const value of Object.values(answerDigest)) {
    const draft = parseAnnotatedMediaEvidenceDraft(value);
    if (draft) return draft;
  }
  return null;
}

function parseAnnotatedMediaEvidenceDraft(
  value: unknown,
): Omit<AnnotatedMediaEvidenceSample, 'sourceLogId'> | null {
  const parsed = typeof value === 'string' ? parseJsonRecord(value) : recordValue(value);
  if (!parsed) return null;
  if (parsed.schemaVersion !== ANNOTATED_MEDIA_EVIDENCE_SCHEMA_VERSION) return null;
  const payload = recordValue(parsed.payload);
  if (!payload) return null;
  if (!stringValue(parsed.eventType) || !stringValue(parsed.clientEventId) || !stringValue(parsed.stepId)) return null;
  if (!stringValue(payload.mediaId) || !Array.isArray(payload.selectedAnnotationIds)) return null;
  return parsed as unknown as Omit<AnnotatedMediaEvidenceSample, 'sourceLogId'>;
}

function compareDiagnosticEvents(left: AnnotatedMediaDiagnosticEvent, right: AnnotatedMediaDiagnosticEvent): number {
  const leftTime = Date.parse(left.serverRecordedAt ?? left.clientEventAt ?? '');
  const rightTime = Date.parse(right.serverRecordedAt ?? right.clientEventAt ?? '');
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime;
  return left.clientEventId.localeCompare(right.clientEventId);
}

function sortedCountsWithLabels<TKey extends 'annotationId' | 'evidenceRole'>(
  items: readonly string[],
  keyName: TKey,
  labelMap: Record<string, string>,
): Array<Record<TKey, string> & { label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (!item.trim()) continue;
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([leftKey, leftCount], [rightKey, rightCount]) => rightCount - leftCount || leftKey.localeCompare(rightKey))
    .map(([key, count]) => ({
      [keyName]: key,
      label: labelMap[key] ?? key,
      count,
    }) as Record<TKey, string> & { label: string; count: number });
}

function sortedMisconceptions(events: readonly AnnotatedMediaDiagnosticEvent[]) {
  const counts = new Map<string, number>();
  for (const event of events) {
    for (const tagId of event.misconceptionTagIds) {
      if (!tagId.trim()) continue;
      counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort(([leftKey, leftCount], [rightKey, rightCount]) => rightCount - leftCount || leftKey.localeCompare(rightKey))
    .map(([misconceptionTagId, count]) => ({ misconceptionTagId, count }));
}

function parseJsonRecord(value: string): Record<string, unknown> | null {
  try {
    return recordValue(JSON.parse(value));
  } catch {
    return null;
  }
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function stringRecordValue(value: unknown): Record<string, string> {
  const record = recordValue(value);
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}
