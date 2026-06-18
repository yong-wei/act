export const STRUCTURE_DIAGRAM_EVIDENCE_SCHEMA_VERSION = 'structure-diagram-evidence-v1';

export const STRUCTURE_DIAGRAM_DIAGNOSTIC_POLICY = {
  denominator: 'latest-attempt-per-student',
  dedupeKey: 'actorId:lessonKey:stepId:moduleId:attemptKey',
  attemptPolicy: 'latest-visible-graph-state-with-resubmission-history',
  resubmissionDisplay: 'latest-with-history-count',
  unreleasedStudentInclusion: 'include-as-unreleased-unvisited',
  revealPolicy: 'declared-reveal-plan-coverage',
  freeTextPolicy: 'teacher-admin-redacted-summary-only',
  freeTextRedaction: 'redact-by-default',
  access: 'teacher-admin-only',
  labelsUseTeachingSemantics: true,
} as const;

export type StructureDiagramComponentKind = 'visual.blockDiagram' | 'visual.signalFlowGraph';

export type StructureDiagramEvidenceClassification =
  | 'InteractionLog'
  | 'StudentStepResponse'
  | 'LearningFact';

export type StructureDiagramConnectionDifference = {
  kind: 'missing' | 'extra' | 'misdirected' | 'wrongGain' | 'wrongLabel';
  from?: string;
  to?: string;
  label: string;
};

export type StructureDiagramConstructedPosition = {
  nodeId: string;
  x: number;
  y: number;
};

export type StructureDiagramConstructedConnection = {
  from: string;
  to: string;
  branchId?: string;
  gainLabel?: string;
};

export type StructureDiagramFeedback = {
  misconceptionTagIds: string[];
  studentFeedbackMode: 'none' | 'hint' | 'explanation' | 'retry';
  teacherNextPrompt: string | null;
  reviewAction: 'retry' | 'review' | 'advance' | 'none';
};

export type StructureDiagramEvidenceInput = {
  eventType: 'graph_view' | 'graph_select' | 'graph_construct' | 'graph_submit' | 'graph_feedback' | 'teacher_reveal';
  clientEventId: string;
  attemptKey: string;
  sourceLogId: string;
  lessonKey: string;
  stepId: string;
  moduleId: string;
  componentKind: StructureDiagramComponentKind;
  componentId: string;
  actorRole: 'student' | 'teacher' | 'admin' | 'guest';
  clientEventAt: string;
  theme: 'light' | 'dark';
  viewport: 'mobile' | 'desktop' | 'projection';
  graphId: string;
  activeRevealState: string;
  selectedNodeIds: string[];
  selectedPathIds: string[];
  selectedLoopIds: string[];
  constructedPositions: StructureDiagramConstructedPosition[];
  constructedConnections: StructureDiagramConstructedConnection[];
  connectionDifferences: StructureDiagramConnectionDifference[];
  teachingLabels: Record<string, string>;
  feedback?: StructureDiagramFeedback;
  classification: StructureDiagramEvidenceClassification[];
  serverRecordedAt?: string;
};

export type StructureDiagramClientEvidenceDraftInput = Omit<
  StructureDiagramEvidenceInput,
  'sourceLogId' | 'serverRecordedAt' | 'classification'
> & {
  classification?: StructureDiagramEvidenceClassification[];
};

export type StructureDiagramEvidenceSample = {
  eventType: StructureDiagramEvidenceInput['eventType'];
  clientEventId: string;
  attemptKey: string;
  sourceLogId: string;
  lessonKey: string;
  stepId: string;
  moduleId: string;
  componentKind: StructureDiagramComponentKind;
  componentId: string;
  actorRole: StructureDiagramEvidenceInput['actorRole'];
  clientEventAt: string;
  theme: StructureDiagramEvidenceInput['theme'];
  viewport: StructureDiagramEvidenceInput['viewport'];
  schemaVersion: typeof STRUCTURE_DIAGRAM_EVIDENCE_SCHEMA_VERSION;
  serverRecordedAt: string | null;
  classification: StructureDiagramEvidenceClassification[];
  affectsTeacherDiagnostics: boolean;
  affectsAbilitySnapshots: boolean;
  affectsRecommendationInputs: boolean;
  payload: {
    theme: StructureDiagramEvidenceInput['theme'];
    viewport: StructureDiagramEvidenceInput['viewport'];
    graphId: string;
    activeRevealState: string;
    selectedNodeIds: string[];
    selectedPathIds: string[];
    selectedLoopIds: string[];
    constructedPositions: StructureDiagramConstructedPosition[];
    constructedConnections: StructureDiagramConstructedConnection[];
    connectionDifferences: StructureDiagramConnectionDifference[];
    teachingLabels: Record<string, string>;
    feedback: StructureDiagramFeedback | null;
    classification: StructureDiagramEvidenceClassification[];
    serverRecordedAt: string | null;
  };
};

export type StructureDiagramDiagnosticEvent = {
  actorId: string;
  actorRole: StructureDiagramEvidenceInput['actorRole'];
  lessonKey: string;
  stepId: string;
  moduleId: string;
  graphId: string;
  viewed: boolean;
  submitted: boolean;
  activeRevealState: string;
  selectedNodeIds: string[];
  selectedPathIds: string[];
  selectedLoopIds: string[];
  connectionDifferences: StructureDiagramConnectionDifference[];
  teachingLabels: Record<string, string>;
  misconceptionTagIds: string[];
  attemptKey: string;
  clientEventId: string;
  clientEventAt?: string;
  serverRecordedAt?: string;
};

export type StructureDiagramTeacherDiagnostics = {
  policy: typeof STRUCTURE_DIAGRAM_DIAGNOSTIC_POLICY;
  viewedCount: number;
  submittedCount: number;
  revealStateDistribution: Array<{ revealState: string; label: string; count: number }>;
  unvisitedRevealStateCount: number;
  selectedNodeDistribution: Array<{ nodeId: string; label: string; count: number }>;
  selectedPathDistribution: Array<{ pathId: string; label: string; count: number }>;
  selectedLoopDistribution: Array<{ loopId: string; label: string; count: number }>;
  connectionDifferenceDistribution: Array<{ kind: StructureDiagramConnectionDifference['kind']; label: string; count: number }>;
  misconceptionDistribution: Array<{ misconceptionTagId: string; count: number }>;
  latestAttemptKeys: string[];
};

export function canViewStructureDiagramTeacherDiagnostics(
  actorRole: StructureDiagramEvidenceInput['actorRole'],
) {
  return actorRole === 'teacher' || actorRole === 'admin';
}

export function buildStructureDiagramEvidenceSample(
  input: StructureDiagramEvidenceInput,
): StructureDiagramEvidenceSample {
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
    theme: input.theme,
    viewport: input.viewport,
    schemaVersion: STRUCTURE_DIAGRAM_EVIDENCE_SCHEMA_VERSION,
    serverRecordedAt,
    classification,
    affectsTeacherDiagnostics: true,
    affectsAbilitySnapshots: classification.includes('LearningFact'),
    affectsRecommendationInputs: classification.includes('LearningFact'),
    payload: {
      theme: input.theme,
      viewport: input.viewport,
      graphId: input.graphId,
      activeRevealState: input.activeRevealState,
      selectedNodeIds: [...input.selectedNodeIds],
      selectedPathIds: [...input.selectedPathIds],
      selectedLoopIds: [...input.selectedLoopIds],
      constructedPositions: input.constructedPositions.map((position) => ({ ...position })),
      constructedConnections: input.constructedConnections.map((connection) => ({ ...connection })),
      connectionDifferences: input.connectionDifferences.map((difference) => ({ ...difference })),
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

export function buildStructureDiagramClientEvidenceDraft(
  input: StructureDiagramClientEvidenceDraftInput,
): Omit<StructureDiagramEvidenceSample, 'sourceLogId'> {
  const materialized = buildStructureDiagramEvidenceSample({
    ...input,
    sourceLogId: '__server_fills_trusted_source_log_id__',
    classification: input.classification ?? defaultClassification(input.eventType),
  });
  const { sourceLogId: _serverOnlySourceLogId, ...draft } = materialized;
  return draft;
}

export function materializeStructureDiagramEvidenceSample({
  draft,
  trustedSourceLogId,
  serverRecordedAt,
}: {
  draft: Omit<StructureDiagramEvidenceSample, 'sourceLogId'>;
  trustedSourceLogId: string;
  serverRecordedAt: string;
}): StructureDiagramEvidenceSample {
  return buildStructureDiagramEvidenceSample({
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
    theme: draft.theme,
    viewport: draft.viewport,
    graphId: draft.payload.graphId,
    activeRevealState: draft.payload.activeRevealState,
    selectedNodeIds: draft.payload.selectedNodeIds,
    selectedPathIds: draft.payload.selectedPathIds,
    selectedLoopIds: draft.payload.selectedLoopIds,
    constructedPositions: draft.payload.constructedPositions,
    constructedConnections: draft.payload.constructedConnections,
    connectionDifferences: draft.payload.connectionDifferences,
    teachingLabels: draft.payload.teachingLabels,
    feedback: draft.payload.feedback ?? undefined,
    classification: draft.payload.classification,
    serverRecordedAt,
  });
}

export function buildStructureDiagramTeacherDiagnostics(
  events: readonly StructureDiagramDiagnosticEvent[],
  revealStateIds: readonly string[],
): StructureDiagramTeacherDiagnostics {
  const latestByDiagnosticKey = new Map<string, StructureDiagramDiagnosticEvent>();
  for (const event of events) {
    if (event.actorRole !== 'student') continue;
    const diagnosticKey = [
      event.actorId,
      event.lessonKey,
      event.stepId,
      event.moduleId,
      event.attemptKey,
    ].join(':');
    const previous = latestByDiagnosticKey.get(diagnosticKey);
    if (!previous || compareDiagnosticEvents(previous, event) < 0) {
      latestByDiagnosticKey.set(diagnosticKey, event);
    }
  }
  const latestEvents = [...latestByDiagnosticKey.values()];
  const labelMap = Object.assign({}, ...latestEvents.map((event) => event.teachingLabels));
  const seenRevealStates = new Set(latestEvents.map((event) => event.activeRevealState));
  return {
    policy: STRUCTURE_DIAGRAM_DIAGNOSTIC_POLICY,
    viewedCount: latestEvents.filter((event) => event.viewed).length,
    submittedCount: latestEvents.filter((event) => event.submitted).length,
    revealStateDistribution: sortedCountsWithLabels(
      latestEvents.map((event) => event.activeRevealState),
      'revealState',
      labelMap,
    ),
    unvisitedRevealStateCount: revealStateIds.filter((revealStateId) => !seenRevealStates.has(revealStateId)).length,
    selectedNodeDistribution: sortedCountsWithLabels(
      latestEvents.flatMap((event) => event.selectedNodeIds),
      'nodeId',
      labelMap,
    ),
    selectedPathDistribution: sortedCountsWithLabels(
      latestEvents.flatMap((event) => event.selectedPathIds),
      'pathId',
      labelMap,
    ),
    selectedLoopDistribution: sortedCountsWithLabels(
      latestEvents.flatMap((event) => event.selectedLoopIds),
      'loopId',
      labelMap,
    ),
    connectionDifferenceDistribution: sortedConnectionDifferences(latestEvents),
    misconceptionDistribution: sortedMisconceptions(latestEvents),
    latestAttemptKeys: latestEvents.map((event) => event.attemptKey).sort(),
  };
}

function validatedClassification(
  eventType: StructureDiagramEvidenceInput['eventType'],
  classification: StructureDiagramEvidenceClassification[],
): StructureDiagramEvidenceClassification[] {
  if (
    (eventType === 'graph_view' || eventType === 'graph_select' || eventType === 'teacher_reveal')
    && classification.includes('LearningFact')
  ) {
    throw new Error(`${eventType} evidence cannot be classified as LearningFact without a response or scoring rule`);
  }
  if ((eventType === 'graph_submit' || eventType === 'graph_feedback') && !classification.includes('StudentStepResponse')) {
    throw new Error(`${eventType} evidence must include StudentStepResponse classification`);
  }
  return [...new Set(classification)];
}

function defaultClassification(
  eventType: StructureDiagramEvidenceInput['eventType'],
): StructureDiagramEvidenceClassification[] {
  if (eventType === 'graph_submit' || eventType === 'graph_feedback') {
    return ['InteractionLog', 'StudentStepResponse'];
  }
  return ['InteractionLog'];
}

function compareDiagnosticEvents(left: StructureDiagramDiagnosticEvent, right: StructureDiagramDiagnosticEvent): number {
  const leftTime = Date.parse(left.serverRecordedAt ?? left.clientEventAt ?? '');
  const rightTime = Date.parse(right.serverRecordedAt ?? right.clientEventAt ?? '');
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime;
  return left.clientEventId.localeCompare(right.clientEventId);
}

function sortedCountsWithLabels<TKey extends 'revealState' | 'nodeId' | 'pathId' | 'loopId'>(
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

function sortedConnectionDifferences(events: readonly StructureDiagramDiagnosticEvent[]) {
  const counts = new Map<string, { kind: StructureDiagramConnectionDifference['kind']; label: string; count: number }>();
  for (const event of events) {
    for (const difference of event.connectionDifferences) {
      const key = `${difference.kind}:${difference.label}`;
      const existing = counts.get(key);
      counts.set(key, {
        kind: difference.kind,
        label: difference.label,
        count: (existing?.count ?? 0) + 1,
      });
    }
  }
  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.kind.localeCompare(right.kind) || left.label.localeCompare(right.label));
}

function sortedMisconceptions(events: readonly StructureDiagramDiagnosticEvent[]) {
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
