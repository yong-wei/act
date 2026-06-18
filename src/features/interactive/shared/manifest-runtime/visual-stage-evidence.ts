export const VISUAL_STAGE_EVIDENCE_SCHEMA_VERSION = 'visual-stage-evidence-v1';

export const VISUAL_STAGE_DIAGNOSTIC_POLICY = {
  denominator: 'released-or-viewed-participants',
  dedupeKey: 'actorRole:lessonKey:stepId:moduleId:attemptKey:clientEventId',
  attemptPolicy: 'latest-stage-event-per-actor',
  resubmissionDisplay: 'latest-visual-state-with-history-count',
  unreleasedStudentInclusion: 'exclude-from-coverage-denominator',
  freeTextRedaction: 'redact-by-default',
  access: 'teacher-admin-only',
} as const;

export type VisualStageEvidenceClassification =
  | 'InteractionLog'
  | 'StudentStepResponse'
  | 'LearningFact';

export type VisualStageEvidenceInput = {
  eventType: 'stage_view' | 'stage_release' | 'stage_reveal' | 'stage_highlight' | 'activity_anchor_view';
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
  releaseState: 'unavailable' | 'unreleased' | 'released' | 'revealed';
  visibleLayerIds: string[];
  activeRevealState?: string | null;
  targetLayerIds?: string[];
  previousRevealState?: string | null;
  nextRevealState?: string | null;
  activityAnchors?: string[];
  classification: VisualStageEvidenceClassification[];
  serverRecordedAt?: string;
};

export type VisualStageClientEvidenceDraftInput = Omit<
  VisualStageEvidenceInput,
  'sourceLogId' | 'serverRecordedAt' | 'classification'
> & {
  classification?: VisualStageEvidenceClassification[];
};

export type VisualStageEvidenceSample = {
  eventType: VisualStageEvidenceInput['eventType'];
  clientEventId: string;
  attemptKey: string;
  sourceLogId: string;
  lessonKey: string;
  stepId: string;
  moduleId: string;
  componentKind: 'visual.stage';
  componentId: string;
  actorRole: VisualStageEvidenceInput['actorRole'];
  clientEventAt: string;
  theme: VisualStageEvidenceInput['theme'];
  viewport: VisualStageEvidenceInput['viewport'];
  schemaVersion: typeof VISUAL_STAGE_EVIDENCE_SCHEMA_VERSION;
  payload: {
    theme: VisualStageEvidenceInput['theme'];
    viewport: VisualStageEvidenceInput['viewport'];
    stageId: string;
    releaseState: VisualStageEvidenceInput['releaseState'];
    visibleLayerIds: string[];
    activeRevealState: string | null;
    targetLayerIds: string[];
    previousRevealState: string | null;
    nextRevealState: string | null;
    activityAnchors: string[];
    classification: VisualStageEvidenceClassification[];
    serverRecordedAt: string | null;
  };
};

export type VisualStageDiagnosticEvent = {
  actorId: string;
  actorRole: VisualStageEvidenceInput['actorRole'];
  lessonKey: string;
  stepId: string;
  moduleId: string;
  viewed: boolean;
  theme: VisualStageEvidenceInput['theme'];
  viewport: VisualStageEvidenceInput['viewport'];
  releaseState: VisualStageEvidenceInput['releaseState'];
  activeRevealState?: string | null;
  visibleLayerIds: string[];
  activityAnchors: string[];
  attemptKey: string;
  clientEventId: string;
  clientEventAt?: string;
  serverRecordedAt?: string;
};

export type VisualStageTeacherDiagnostics = {
  policy: typeof VISUAL_STAGE_DIAGNOSTIC_POLICY;
  viewedCount: number;
  releasedCount: number;
  currentRevealState: string | null;
  visibleLayerCoverage: Array<{ layerId: string; count: number }>;
  activityAnchorCoverage: Array<{ activityAnchor: string; count: number }>;
  latestAttemptKeys: string[];
};

export function buildVisualStageEvidenceSample(
  input: VisualStageEvidenceInput,
): VisualStageEvidenceSample {
  return {
    eventType: input.eventType,
    clientEventId: input.clientEventId,
    attemptKey: input.attemptKey,
    sourceLogId: input.sourceLogId,
    lessonKey: input.lessonKey,
    stepId: input.stepId,
    moduleId: input.moduleId,
    componentKind: 'visual.stage',
    componentId: input.componentId,
    actorRole: input.actorRole,
    clientEventAt: input.clientEventAt,
    theme: input.theme,
    viewport: input.viewport,
    schemaVersion: VISUAL_STAGE_EVIDENCE_SCHEMA_VERSION,
    payload: {
      theme: input.theme,
      viewport: input.viewport,
      stageId: input.stageId,
      releaseState: input.releaseState,
      visibleLayerIds: [...input.visibleLayerIds],
      activeRevealState: input.activeRevealState ?? null,
      targetLayerIds: input.targetLayerIds ? [...input.targetLayerIds] : [],
      previousRevealState: input.previousRevealState ?? null,
      nextRevealState: input.nextRevealState ?? null,
      activityAnchors: input.activityAnchors ? [...input.activityAnchors] : [],
      classification: validatedClassification(input.eventType, input.classification),
      serverRecordedAt: input.serverRecordedAt ?? null,
    },
  };
}

export function buildVisualStageClientEvidenceDraft(
  input: VisualStageClientEvidenceDraftInput,
): Omit<VisualStageEvidenceSample, 'sourceLogId'> {
  const materialized = buildVisualStageEvidenceSample({
    ...input,
    sourceLogId: '__server_fills_trusted_source_log_id__',
    classification: input.classification ?? ['InteractionLog'],
  });
  const { sourceLogId: _serverOnlySourceLogId, ...draft } = materialized;
  return draft;
}

export function materializeVisualStageEvidenceSample({
  draft,
  trustedSourceLogId,
  serverRecordedAt,
}: {
  draft: Omit<VisualStageEvidenceSample, 'sourceLogId'>;
  trustedSourceLogId: string;
  serverRecordedAt: string;
}): VisualStageEvidenceSample {
  return buildVisualStageEvidenceSample({
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
    releaseState: draft.payload.releaseState,
    visibleLayerIds: draft.payload.visibleLayerIds,
    activeRevealState: draft.payload.activeRevealState,
    targetLayerIds: draft.payload.targetLayerIds,
    previousRevealState: draft.payload.previousRevealState,
    nextRevealState: draft.payload.nextRevealState,
    activityAnchors: draft.payload.activityAnchors,
    classification: draft.payload.classification,
    serverRecordedAt,
  });
}

export function buildVisualStageTeacherDiagnostics(
  events: readonly VisualStageDiagnosticEvent[],
): VisualStageTeacherDiagnostics {
  const latestByActor = new Map<string, VisualStageDiagnosticEvent>();
  for (const event of [...events].sort(compareDiagnosticEvents)) {
    latestByActor.set(diagnosticScopeKey(event), event);
  }
  const latest = Array.from(latestByActor.values());
  const layerCounts = new Map<string, number>();
  const anchorCounts = new Map<string, number>();
  for (const event of latest) {
    for (const layerId of new Set(event.visibleLayerIds)) {
      layerCounts.set(layerId, (layerCounts.get(layerId) ?? 0) + 1);
    }
    for (const activityAnchor of new Set(event.activityAnchors)) {
      anchorCounts.set(activityAnchor, (anchorCounts.get(activityAnchor) ?? 0) + 1);
    }
  }
  const latestReveal = [...latest]
    .reverse()
    .find((event) => event.activeRevealState);

  return {
    policy: VISUAL_STAGE_DIAGNOSTIC_POLICY,
    viewedCount: latest.filter((event) => event.viewed).length,
    releasedCount: latest.filter((event) => event.releaseState !== 'unreleased' && event.releaseState !== 'unavailable').length,
    currentRevealState: latestReveal?.activeRevealState ?? null,
    visibleLayerCoverage: sortedCounts(layerCounts, 'layerId'),
    activityAnchorCoverage: sortedCounts(anchorCounts, 'activityAnchor'),
    latestAttemptKeys: latest.map((event) => event.attemptKey).sort(),
  };
}

function compareDiagnosticEvents(left: VisualStageDiagnosticEvent, right: VisualStageDiagnosticEvent): number {
  const leftTime = Date.parse(left.serverRecordedAt ?? left.clientEventAt ?? '');
  const rightTime = Date.parse(right.serverRecordedAt ?? right.clientEventAt ?? '');
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime;
  return left.clientEventId.localeCompare(right.clientEventId);
}

function validatedClassification(
  eventType: VisualStageEvidenceInput['eventType'],
  classification: VisualStageEvidenceClassification[],
): VisualStageEvidenceClassification[] {
  const normalized = [...new Set(classification)];
  if (
    (eventType === 'stage_view' || eventType === 'stage_reveal')
    && normalized.includes('LearningFact')
  ) {
    throw new Error(`${eventType} evidence cannot be classified as LearningFact without a declared activity response.`);
  }
  return normalized;
}

function diagnosticScopeKey(event: VisualStageDiagnosticEvent): string {
  return [
    event.actorId,
    event.actorRole,
    event.lessonKey,
    event.stepId,
    event.moduleId,
  ].join(':');
}

function sortedCounts<K extends 'layerId' | 'activityAnchor'>(
  counts: Map<string, number>,
  key: K,
): Array<Record<K, string> & { count: number }> {
  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, count]) => ({ [key]: value, count }) as Record<K, string> & { count: number });
}
