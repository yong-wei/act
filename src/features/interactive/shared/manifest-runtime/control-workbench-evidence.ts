export const CONTROL_WORKBENCH_EVIDENCE_SCHEMA_VERSION = 'control-workbench-evidence-v1';

export const CONTROL_WORKBENCH_DIAGNOSTIC_POLICY = {
  denominator: 'released-or-viewed-participants',
  dedupeKey: 'actorRole:lessonKey:stepId:moduleId:attemptKey:clientEventId',
  attemptPolicy: 'latest-submission-and-all-exploration',
  resubmissionDisplay: 'latest-with-history-count',
  unreleasedStudentInclusion: 'exclude-from-coverage-denominator',
  freeTextRedaction: 'redact-by-default',
  access: 'teacher-admin-only',
} as const;

export type ControlWorkbenchEvidenceClassification =
  | 'InteractionLog'
  | 'StudentStepResponse'
  | 'LearningFact';

export type ControlWorkbenchEvidenceInput = {
  eventType: string;
  clientEventId: string;
  attemptKey: string;
  sourceLogId: string;
  lessonKey: string;
  stepId: string;
  moduleId: string;
  componentId: string;
  actorRole: 'student' | 'teacher' | 'admin' | 'guest';
  clientEventAt: string;
  capabilityId: string;
  visiblePanelIds: string[];
  parameterSnapshot: Record<string, unknown>;
  selectedDesignState?: Record<string, unknown>;
  derivedResultRefs?: Array<{ kind: string; id: string }>;
  answerPayload?: Record<string, unknown>;
  releaseState: 'unreleased' | 'released' | 'revealed';
  fallbackState: 'supported' | 'fallback' | 'unsupported';
  classification: ControlWorkbenchEvidenceClassification[];
  serverRecordedAt?: string;
};

export type ControlWorkbenchClientEvidenceDraftInput = Omit<
  ControlWorkbenchEvidenceInput,
  'sourceLogId' | 'serverRecordedAt' | 'classification'
> & {
  classification?: ControlWorkbenchEvidenceClassification[];
};

export type ControlWorkbenchEvidenceSample = {
  eventType: string;
  clientEventId: string;
  attemptKey: string;
  sourceLogId: string;
  lessonKey: string;
  stepId: string;
  moduleId: string;
  componentKind: 'compute.panel';
  componentId: string;
  actorRole: ControlWorkbenchEvidenceInput['actorRole'];
  clientEventAt: string;
  schemaVersion: typeof CONTROL_WORKBENCH_EVIDENCE_SCHEMA_VERSION;
  payload: {
    capabilityId: string;
    visiblePanelIds: string[];
    parameterSnapshot: Record<string, unknown>;
    selectedDesignState: Record<string, unknown> | null;
    derivedResultRefs: Array<{ kind: string; id: string }>;
    answerPayload: Record<string, unknown> | null;
    releaseState: ControlWorkbenchEvidenceInput['releaseState'];
    fallbackState: ControlWorkbenchEvidenceInput['fallbackState'];
    classification: ControlWorkbenchEvidenceClassification[];
    serverRecordedAt: string | null;
  };
};

export type ControlWorkbenchDiagnosticEvent = {
  actorId: string;
  actorRole: ControlWorkbenchEvidenceInput['actorRole'];
  lessonKey: string;
  stepId: string;
  moduleId: string;
  viewed: boolean;
  submitted: boolean;
  releaseState: ControlWorkbenchEvidenceInput['releaseState'];
  fallbackState: ControlWorkbenchEvidenceInput['fallbackState'];
  touchedParameterIds: string[];
  judgmentOutcome?: string | null;
  attemptKey: string;
  clientEventId: string;
  clientEventAt?: string;
  serverRecordedAt?: string;
};

export type ControlWorkbenchTeacherDiagnostics = {
  policy: typeof CONTROL_WORKBENCH_DIAGNOSTIC_POLICY;
  viewedCount: number;
  submittedCount: number;
  releasedCount: number;
  fallbackCount: number;
  unsupportedCount: number;
  parameterCoverage: Array<{ parameterId: string; count: number }>;
  judgmentOutcomes: Array<{ outcome: string; count: number }>;
  latestAttemptKeys: string[];
};

export function buildControlWorkbenchEvidenceSample(
  input: ControlWorkbenchEvidenceInput,
): ControlWorkbenchEvidenceSample {
  return {
    eventType: input.eventType,
    clientEventId: input.clientEventId,
    attemptKey: input.attemptKey,
    sourceLogId: input.sourceLogId,
    lessonKey: input.lessonKey,
    stepId: input.stepId,
    moduleId: input.moduleId,
    componentKind: 'compute.panel',
    componentId: input.componentId,
    actorRole: input.actorRole,
    clientEventAt: input.clientEventAt,
    schemaVersion: CONTROL_WORKBENCH_EVIDENCE_SCHEMA_VERSION,
    payload: {
      capabilityId: input.capabilityId,
      visiblePanelIds: [...input.visiblePanelIds],
      parameterSnapshot: redactEvidenceRecord(input.parameterSnapshot),
      selectedDesignState: input.selectedDesignState ? redactEvidenceRecord(input.selectedDesignState) : null,
      derivedResultRefs: input.derivedResultRefs ? [...input.derivedResultRefs] : [],
      answerPayload: input.answerPayload ? redactEvidenceRecord(input.answerPayload) : null,
      releaseState: input.releaseState,
      fallbackState: input.fallbackState,
      classification: [...input.classification],
      serverRecordedAt: input.serverRecordedAt ?? null,
    },
  };
}

export function buildControlWorkbenchClientEvidenceDraft(
  input: ControlWorkbenchClientEvidenceDraftInput,
): Omit<ControlWorkbenchEvidenceSample, 'sourceLogId'> {
  const materialized = buildControlWorkbenchEvidenceSample({
    ...input,
    sourceLogId: '__server_fills_trusted_source_log_id__',
    classification: input.classification ?? ['InteractionLog', 'StudentStepResponse'],
  });
  const { sourceLogId: _serverOnlySourceLogId, ...draft } = materialized;
  return draft;
}

export function materializeControlWorkbenchEvidenceSample({
  draft,
  trustedSourceLogId,
  serverRecordedAt,
}: {
  draft: Omit<ControlWorkbenchEvidenceSample, 'sourceLogId'>;
  trustedSourceLogId: string;
  serverRecordedAt: string;
}): ControlWorkbenchEvidenceSample {
  return buildControlWorkbenchEvidenceSample({
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
    capabilityId: String(draft.payload.capabilityId),
    visiblePanelIds: [...draft.payload.visiblePanelIds],
    parameterSnapshot: draft.payload.parameterSnapshot,
    selectedDesignState: draft.payload.selectedDesignState ?? undefined,
    derivedResultRefs: draft.payload.derivedResultRefs,
    answerPayload: draft.payload.answerPayload ?? undefined,
    releaseState: draft.payload.releaseState,
    fallbackState: draft.payload.fallbackState,
    classification: draft.payload.classification,
    serverRecordedAt,
  });
}

export function materializeControlWorkbenchEvidenceFromSubmissionPayload(
  payload: Record<string, unknown>,
  {
    trustedSourceLogId,
    serverRecordedAt,
  }: {
    trustedSourceLogId: string;
    serverRecordedAt: string;
  },
): ControlWorkbenchEvidenceSample | null {
  const draft = findControlWorkbenchEvidenceDraft(payload);
  if (!draft) return null;
  return materializeControlWorkbenchEvidenceSample({
    draft,
    trustedSourceLogId,
    serverRecordedAt,
  });
}

export function buildControlWorkbenchTeacherDiagnostics(
  events: readonly ControlWorkbenchDiagnosticEvent[],
): ControlWorkbenchTeacherDiagnostics {
  const latestByActor = new Map<string, ControlWorkbenchDiagnosticEvent>();
  for (const event of [...events].sort(compareDiagnosticEvents)) {
    latestByActor.set(diagnosticScopeKey(event), event);
  }
  const latest = Array.from(latestByActor.values());
  const parameterCounts = new Map<string, number>();
  const judgmentCounts = new Map<string, number>();

  for (const event of latest) {
    for (const parameterId of new Set(event.touchedParameterIds)) {
      parameterCounts.set(parameterId, (parameterCounts.get(parameterId) ?? 0) + 1);
    }
    if (event.judgmentOutcome) {
      judgmentCounts.set(event.judgmentOutcome, (judgmentCounts.get(event.judgmentOutcome) ?? 0) + 1);
    }
  }

  return {
    policy: CONTROL_WORKBENCH_DIAGNOSTIC_POLICY,
    viewedCount: latest.filter((event) => event.viewed).length,
    submittedCount: latest.filter((event) => event.submitted).length,
    releasedCount: latest.filter((event) => event.releaseState !== 'unreleased').length,
    fallbackCount: latest.filter((event) => event.fallbackState === 'fallback').length,
    unsupportedCount: latest.filter((event) => event.fallbackState === 'unsupported').length,
    parameterCoverage: sortedCounts(parameterCounts, 'parameterId'),
    judgmentOutcomes: sortedCounts(judgmentCounts, 'outcome'),
    latestAttemptKeys: latest.map((event) => event.attemptKey).sort(),
  };
}

function compareDiagnosticEvents(left: ControlWorkbenchDiagnosticEvent, right: ControlWorkbenchDiagnosticEvent): number {
  const leftTime = Date.parse(left.serverRecordedAt ?? left.clientEventAt ?? '');
  const rightTime = Date.parse(right.serverRecordedAt ?? right.clientEventAt ?? '');
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime;
  return left.clientEventId.localeCompare(right.clientEventId);
}

function diagnosticScopeKey(event: ControlWorkbenchDiagnosticEvent): string {
  return [
    event.actorId,
    event.actorRole,
    event.lessonKey,
    event.stepId,
    event.moduleId,
  ].join(':');
}

function findControlWorkbenchEvidenceDraft(
  payload: Record<string, unknown>,
): Omit<ControlWorkbenchEvidenceSample, 'sourceLogId'> | null {
  const directDraft = parseControlWorkbenchEvidenceDraft(payload.controlWorkbenchEvidenceDraft);
  if (directDraft) return directDraft;

  const answerDigest = recordValue(payload.answerDigest ?? payload.answers) ?? {};
  for (const value of Object.values(answerDigest)) {
    const draft = parseControlWorkbenchEvidenceDraft(value);
    if (draft) return draft;
  }
  return null;
}

function parseControlWorkbenchEvidenceDraft(
  value: unknown,
): Omit<ControlWorkbenchEvidenceSample, 'sourceLogId'> | null {
  const parsed = typeof value === 'string' ? parseJsonRecord(value) : recordValue(value);
  if (!parsed) return null;
  if (parsed.schemaVersion !== CONTROL_WORKBENCH_EVIDENCE_SCHEMA_VERSION) return null;
  const payload = recordValue(parsed.payload);
  if (!payload) return null;
  if (!stringValue(parsed.eventType) || !stringValue(parsed.clientEventId) || !stringValue(parsed.stepId)) return null;
  if (!stringValue(payload.capabilityId) || !Array.isArray(payload.visiblePanelIds)) return null;
  return parsed as unknown as Omit<ControlWorkbenchEvidenceSample, 'sourceLogId'>;
}

function redactEvidenceRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      redactEvidenceValue(key, value),
    ]),
  );
}

function redactEvidenceValue(key: string, value: unknown): unknown {
  if (shouldRedactEvidenceField(key, value)) return '[redacted]';
  if (Array.isArray(value)) return value.map((item) => redactEvidenceValue(key, item));
  const record = recordValue(value);
  if (record) return redactEvidenceRecord(record);
  return value;
}

function shouldRedactEvidenceField(key: string, value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return /(freeText|free_text|comment|note|observation|answerText|studentText|text)$/i.test(key)
    || value.length > 160;
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

function sortedCounts<K extends 'parameterId' | 'outcome'>(
  counts: Map<string, number>,
  key: K,
): Array<Record<K, string> & { count: number }> {
  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, count]) => ({ [key]: value, count }) as Record<K, string> & { count: number });
}
