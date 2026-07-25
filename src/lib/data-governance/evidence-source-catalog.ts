export type EvidenceSourceId =
  | 'InteractionLog'
  | 'StudentStepResponse'
  | 'SimulationSession'
  | 'SimulationRun'
  | 'SimulationLog'
  | 'UserAnswer'
  | 'AbilityAssessment'
  | 'PromptAssessment'
  | 'DesignSession'
  | 'ArenaBlackBoxExperiment'
  | 'ArenaVirtualSimulationRun'
  | 'ArenaSubmission'
  | 'ArenaEvaluationRun'
  | 'LearningFact';

export type EvidenceScope =
  | 'classroom-bound'
  | 'standalone'
  | 'out-of-class'
  | 'historical'
  | 'mixed';

export type EvidenceValueLevel = 'high' | 'medium' | 'low' | 'context';

export type EvidenceEligibility =
  | 'eligible'
  | 'excluded'
  | 'context-only'
  | 'unsupported';

export type EvidenceMaterializationReadiness =
  | 'ready'
  | 'partial'
  | 'future'
  | 'already-materialized';

export type EvidenceProvenance =
  | 'real'
  | 'seed'
  | 'showcase'
  | 'demo'
  | 'test'
  | 'unknown';

export interface EvidenceSourceCatalogEntry {
  id: EvidenceSourceId;
  tableName: EvidenceSourceId;
  description: string;
  learningScope: EvidenceScope;
  defaultValueLevel: EvidenceValueLevel;
  defaultEligibility: EvidenceEligibility;
  materializationReadiness: EvidenceMaterializationReadiness;
  userIdField?: string;
  timestampField?: string;
  traceabilityFields: string[];
  provenancePolicy: string;
  taskEvidencePolicy?: {
    sourceFamily: 'virtual-simulation' | 'control-workbench' | 'arena' | 'odyssey';
    eligibleEventTypes: string[];
    ineligibleEventTypes: string[];
    taskIdentityFields: string[];
    summaryFields: string[];
    requiresStudentOwnership: boolean;
    linkedSourceOnly?: boolean;
  };
}

export interface EvidenceCoverageRow {
  id: string;
  sourceId?: EvidenceSourceId;
  userId?: string | null;
  occurredAt?: string | Date | null;
  eventType?: string | null;
  eventData?: unknown;
  sourceLabel?: string | null;
  resourceId?: string | null;
  resourceKey?: string | null;
  sessionId?: string | null;
  lessonKey?: string | null;
  stepId?: string | null;
  attemptKey?: string | null;
  clientEventId?: string | null;
  learningContext?: string | null;
  invalidContextReason?: string | null;
  readinessGaps?: string[];
}

export interface InteractionLogEventTypeResolution {
  canonicalEventType: string;
  wrapperEventType: string;
  source: 'payload' | 'wrapper';
  missingPayloadEventType: boolean;
}

export interface EvidenceRowClassification {
  sourceId: EvidenceSourceId;
  provenance: EvidenceProvenance;
  learningScope: EvidenceScope;
  valueLevel: EvidenceValueLevel;
  eligibility: EvidenceEligibility;
  materializationReadiness: EvidenceMaterializationReadiness;
  canonicalEventType?: string;
  wrapperEventType?: string;
  exclusionReason?: string;
  readinessGaps?: string[];
}

export interface EvidenceSourceCoverage {
  sourceId: EvidenceSourceId;
  tableName: EvidenceSourceId;
  learningScope: EvidenceScope;
  totalRows: number;
  eligibleRows: number;
  excludedRows: number;
  unsupportedRows: number;
  affectedUsers: number;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  provenanceCounts: Partial<Record<EvidenceProvenance, number>>;
  eligibilityCounts: Partial<Record<EvidenceEligibility, number>>;
  valueLevelCounts: Partial<Record<EvidenceValueLevel, number>>;
  materializationReadiness: EvidenceMaterializationReadiness;
  readinessGapCounts: Record<string, number>;
  sampleSourceReferences: string[];
}

export interface EvidenceCoverageExclusion {
  sourceId: EvidenceSourceId;
  reason: string;
  rowCount: number;
  affectedUsers: number;
  sampleSourceReference: string | null;
}

export interface EvidenceSourceCoverageReport {
  generatedAt: string;
  catalogVersion: string;
  totals: {
    totalRows: number;
    eligibleRows: number;
    excludedRows: number;
    unsupportedRows: number;
    affectedUsers: number;
  };
  sources: EvidenceSourceCoverage[];
  exclusions: EvidenceCoverageExclusion[];
}

export interface BuildEvidenceSourceCoverageReportInput {
  generatedAt?: string;
  rowsBySource: Partial<Record<EvidenceSourceId, EvidenceCoverageRow[]>>;
}

const CATALOG_VERSION = '2026-07-25';

const HIGH_VALUE_INTERACTION_EVENTS = new Set([
  'answer_submit',
  'assessment_complete',
  'lesson_submit',
  'lesson_resubmit',
  'session_finalize',
  'resource_complete',
  'simulation_finish',
  'prompt_assessed',
  'design_session_complete',
  'ethical_violation',
  'ethical_resolved',
  'arena_submit',
  'arena_evaluation_complete',
  'arena_controller_save',
  'arena_identification_model_save',
  'arena_virtual_simulation_import',
  'arena_virtual_simulation_start',
  'arena_blackbox_experiment_create',
  'simulation_session_start',
  'simulation_session_complete',
]);

const LOW_VALUE_INTERACTION_EVENTS = new Set([
  'page_view',
  'view',
  'lesson_step_view',
  'route_change',
  'navigation',
  'knowledge_card_open',
  'resource_open',
  'resource_view',
  'arena_challenge_open',
  'arena_workspace_start',
  'arena_result_view',
  'arena_leaderboard_view',
  'arena_feedback_view',
  'simulation_scene_view',
  'simulation_help_open',
]);

const CATALOG: EvidenceSourceCatalogEntry[] = [
  {
    id: 'InteractionLog',
    tableName: 'InteractionLog',
    description: 'Raw interactive and resource telemetry, including classroom wrappers and standalone activity.',
    learningScope: 'mixed',
    defaultValueLevel: 'medium',
    defaultEligibility: 'eligible',
    materializationReadiness: 'partial',
    userIdField: 'userId',
    timestampField: 'createdAt',
    traceabilityFields: ['id', 'clientEventId', 'sessionId', 'lessonKey', 'stepId', 'resourceKey'],
    provenancePolicy: 'Infer from eventData source fields when present; unknown provenance is reported separately.',
    taskEvidencePolicy: {
      sourceFamily: 'control-workbench',
      eligibleEventTypes: ['design_session_complete', 'workspace_submission'],
      ineligibleEventTypes: ['page_view', 'view', 'param_change', 'arena_result_view'],
      taskIdentityFields: ['resourceKey', 'lessonKey', 'stepId'],
      summaryFields: ['sourceLogId', 'capabilityId', 'visiblePanelIds', 'derivedResultRefs'],
      requiresStudentOwnership: true,
    },
  },
  {
    id: 'StudentStepResponse',
    tableName: 'StudentStepResponse',
    description: 'Durable classroom step submissions derived from interaction logs.',
    learningScope: 'classroom-bound',
    defaultValueLevel: 'high',
    defaultEligibility: 'eligible',
    materializationReadiness: 'ready',
    userIdField: 'userId',
    timestampField: 'submittedAt',
    traceabilityFields: ['id', 'sourceLogId', 'clientEventId', 'sessionId', 'lessonKey', 'stepId'],
    provenancePolicy: 'Classroom submission provenance follows the linked session and source interaction log.',
  },
  {
    id: 'SimulationSession',
    tableName: 'SimulationSession',
    description: 'Simulation run/session envelope stored with module, type, params, output summary, and artifacts.',
    learningScope: 'mixed',
    defaultValueLevel: 'high',
    defaultEligibility: 'eligible',
    materializationReadiness: 'partial',
    userIdField: 'userId',
    timestampField: 'createdAt',
    traceabilityFields: ['id', 'userId', 'module', 'simType'],
    provenancePolicy: 'Sessions inherit provenance from module context and input params payload.',
  },
  {
    id: 'SimulationRun',
    tableName: 'SimulationRun',
    description: 'Canonical completed virtual-simulation runs with task, model, trace, and owner identity.',
    learningScope: 'mixed',
    defaultValueLevel: 'high',
    defaultEligibility: 'eligible',
    materializationReadiness: 'ready',
    userIdField: 'ownerUserId',
    timestampField: 'completedAt',
    traceabilityFields: ['id', 'ownerUserId', 'resourceId', 'taskSpecId', 'sourceDomain', 'sourceRefId'],
    provenancePolicy: 'Run provenance follows sourceDomain and immutable task-spec snapshots.',
    taskEvidencePolicy: {
      sourceFamily: 'virtual-simulation',
      eligibleEventTypes: ['simulation_finish', 'simulation_session_complete'],
      ineligibleEventTypes: ['simulation_scene_view', 'simulation_help_open', 'param_change'],
      taskIdentityFields: ['resourceId', 'taskSpecId', 'taskSpecSnapshot.sceneId'],
      summaryFields: ['id', 'modelVersion', 'controllerSnapshotRef', 'summary'],
      requiresStudentOwnership: true,
    },
  },
  {
    id: 'SimulationLog',
    tableName: 'SimulationLog',
    description: 'Simulation attempts and game-like control practice records.',
    learningScope: 'out-of-class',
    defaultValueLevel: 'high',
    defaultEligibility: 'eligible',
    materializationReadiness: 'ready',
    userIdField: 'userId',
    timestampField: 'createdAt',
    traceabilityFields: ['id', 'missionId', 'sessionId'],
    provenancePolicy: 'Infer from payload markers when present; historical rows without markers remain unknown.',
    taskEvidencePolicy: {
      sourceFamily: 'odyssey',
      eligibleEventTypes: ['odyssey_level_clear', 'odyssey_persistent_clear'],
      ineligibleEventTypes: ['view', 'param_change'],
      taskIdentityFields: ['missionId', 'inputParams.levelId', 'inputParams.arenaTaskId'],
      summaryFields: ['id', 'score', 'metrics', 'odysseyCompletedAt'],
      requiresStudentOwnership: true,
    },
  },
  {
    id: 'UserAnswer',
    tableName: 'UserAnswer',
    description: 'Objective question answer records linked to the question bank.',
    learningScope: 'out-of-class',
    defaultValueLevel: 'high',
    defaultEligibility: 'eligible',
    materializationReadiness: 'ready',
    userIdField: 'userId',
    timestampField: 'createdAt',
    traceabilityFields: ['id', 'questionId'],
    provenancePolicy: 'Question.source marks seed, showcase, demo, or test rows when available.',
  },
  {
    id: 'AbilityAssessment',
    tableName: 'AbilityAssessment',
    description: 'Aggregated ability theta assessments already used as profile evidence.',
    learningScope: 'historical',
    defaultValueLevel: 'high',
    defaultEligibility: 'eligible',
    materializationReadiness: 'already-materialized',
    userIdField: 'userId',
    timestampField: 'assessedAt',
    traceabilityFields: ['id'],
    provenancePolicy: 'Assessment rows are treated as unknown provenance unless generated by a marked seed pipeline.',
  },
  {
    id: 'PromptAssessment',
    tableName: 'PromptAssessment',
    description: 'Prompt quality assessment rows from AI learning tasks.',
    learningScope: 'standalone',
    defaultValueLevel: 'high',
    defaultEligibility: 'eligible',
    materializationReadiness: 'ready',
    userIdField: 'userId',
    timestampField: 'createdAt',
    traceabilityFields: ['id', 'sessionId', 'version'],
    provenancePolicy: 'Prompt rows are unknown provenance unless the session payload identifies a seed or demo source.',
  },
  {
    id: 'DesignSession',
    tableName: 'DesignSession',
    description: 'Structured design-session process and final-result records.',
    learningScope: 'standalone',
    defaultValueLevel: 'high',
    defaultEligibility: 'eligible',
    materializationReadiness: 'ready',
    userIdField: 'userId',
    timestampField: 'startedAt',
    traceabilityFields: ['id', 'taskType'],
    provenancePolicy: 'Design rows are unknown provenance unless action payloads identify a seed or demo source.',
  },
  {
    id: 'ArenaBlackBoxExperiment',
    tableName: 'ArenaBlackBoxExperiment',
    description: 'Arena public experiment datasets and budget evidence.',
    learningScope: 'standalone',
    defaultValueLevel: 'medium',
    defaultEligibility: 'eligible',
    materializationReadiness: 'ready',
    userIdField: 'userId',
    timestampField: 'createdAt',
    traceabilityFields: ['id', 'userId', 'taskId', 'datasetHash', 'signalType', 'budgetCost'],
    provenancePolicy: 'Experiment rows mark seed, demo, or real datasets through signalType and payload metadata.',
  },
  {
    id: 'ArenaVirtualSimulationRun',
    tableName: 'ArenaVirtualSimulationRun',
    description: 'Arena preview traces and controller exploration evidence.',
    learningScope: 'standalone',
    defaultValueLevel: 'high',
    defaultEligibility: 'eligible',
    materializationReadiness: 'ready',
    userIdField: 'userId',
    timestampField: 'createdAt',
    traceabilityFields: ['id', 'userId', 'simulationRunId', 'taskId', 'datasetHash', 'controllerHash', 'scenarioId'],
    provenancePolicy: 'Preview runs derive provenance from task and dataset context.',
  },
  {
    id: 'ArenaSubmission',
    tableName: 'ArenaSubmission',
    description: 'Arena controller submissions with score, task, class, season, and publication scope.',
    learningScope: 'mixed',
    defaultValueLevel: 'high',
    defaultEligibility: 'eligible',
    materializationReadiness: 'ready',
    userIdField: 'userId',
    timestampField: 'submittedAt',
    traceabilityFields: ['id', 'taskId', 'classId', 'seasonId', 'publicationId', 'evaluationRunId'],
    provenancePolicy: 'Challenge publication and task metadata distinguish classroom-bound from standalone usage.',
    taskEvidencePolicy: {
      sourceFamily: 'arena',
      eligibleEventTypes: ['arena_submit'],
      ineligibleEventTypes: ['arena_challenge_open', 'arena_result_view', 'arena_leaderboard_view'],
      taskIdentityFields: ['taskId', 'evaluationRunId'],
      summaryFields: ['id', 'taskId', 'artifactHash', 'score', 'valid'],
      requiresStudentOwnership: true,
    },
  },
  {
    id: 'ArenaEvaluationRun',
    tableName: 'ArenaEvaluationRun',
    description: 'Arena evaluation artifacts with protocol version and trace reference. No direct user ownership.',
    learningScope: 'historical',
    defaultValueLevel: 'medium',
    defaultEligibility: 'unsupported',
    materializationReadiness: 'future',
    timestampField: 'completedAt',
    traceabilityFields: ['id', 'taskId', 'artifactHash', 'protocolVersion'],
    provenancePolicy: 'Evaluation runs lack user ownership; user attribution comes through a linked ArenaSubmission. Kept unsupported until submission-to-evaluation linking is materialized.',
    taskEvidencePolicy: {
      sourceFamily: 'arena',
      eligibleEventTypes: ['arena_evaluation_complete'],
      ineligibleEventTypes: [],
      taskIdentityFields: ['taskId', 'artifactHash', 'protocolVersion'],
      summaryFields: ['id', 'taskId', 'protocolVersion', 'valid', 'score'],
      requiresStudentOwnership: true,
      linkedSourceOnly: true,
    },
  },
  {
    id: 'LearningFact',
    tableName: 'LearningFact',
    description: 'Already materialized governed learning facts.',
    learningScope: 'mixed',
    defaultValueLevel: 'high',
    defaultEligibility: 'eligible',
    materializationReadiness: 'already-materialized',
    userIdField: 'userId',
    timestampField: 'startedAt',
    traceabilityFields: ['id', 'sourceEventId', 'sourceLogId', 'sessionId', 'lessonId', 'moduleId'],
    provenancePolicy: 'Learning facts preserve source references; source provenance remains auditable through origin records.',
  },
];

const CATALOG_BY_ID = new Map(CATALOG.map((entry) => [entry.id, entry]));

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizeDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function increment<T extends string>(target: Partial<Record<T, number>>, key: T, amount = 1) {
  target[key] = (target[key] ?? 0) + amount;
}

function inferProvenanceFromText(value: string | undefined): EvidenceProvenance | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.includes('test')) return 'test';
  if (normalized.includes('demo')) return 'demo';
  if (normalized.includes('seed')) return 'seed';
  if (normalized.includes('showcase')) return 'showcase';
  if (normalized.includes('real')) return 'real';
  return null;
}

function inferProvenance(row: EvidenceCoverageRow): EvidenceProvenance {
  const payload = readRecord(row.eventData);
  const candidates = [
    row.sourceLabel,
    payload.source,
    payload.sourceType,
    payload.sourceSystem,
    payload.origin,
    payload.provenance,
  ]
    .map((value) => readString(value))
    .filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const provenance = inferProvenanceFromText(candidate);
    if (provenance) return provenance;
  }

  return 'unknown';
}

function isNonRealProvenance(provenance: EvidenceProvenance) {
  return provenance === 'seed' || provenance === 'showcase' || provenance === 'demo' || provenance === 'test';
}

function collectArenaPreviewReadinessGaps(row: EvidenceCoverageRow): string[] {
  const payload = readRecord(row.eventData);
  const summary = readRecord(payload.summary);
  const replay = readRecord(payload.replay);
  const metadata = readRecord(payload.metadata ?? readRecord(summary).previewBoundary);
  const gaps = new Set<string>();

  for (const gap of row.readinessGaps ?? []) {
    if (gap.trim()) gaps.add(gap.trim());
  }

  if (!readString(payload.simulationRunId)) gaps.add('missing_simulation_run_mapping');
  if (!readString(row.userId)) gaps.add('missing_owner_user');
  if (!readString(row.id) && !readString(payload.arenaPreviewDetailId)) gaps.add('missing_arena_detail_reference');
  if (!readString(replay.checksum) && !readString(payload.replayToken)) gaps.add('missing_replay_metadata');
  if (
    !(
      typeof summary.trackingError === 'number' ||
      typeof summary.maxDeviation === 'number' ||
      typeof summary.controlEnergy === 'number' ||
      typeof summary.safetyViolations === 'number' ||
      typeof summary.smoothness === 'number'
    )
  ) {
    gaps.add('missing_summary_metrics');
  }
  if (
    metadata.evaluationVisibility !== 'preview' ||
    readBoolean(metadata.officialEligible) !== false ||
    !readString(metadata.modelRelation) ||
    !readString(metadata.datasetHash) ||
    !readString(metadata.controllerHash) ||
    !readString(metadata.identificationModelId) ||
    !readString(metadata.sourceExperimentId)
  ) {
    gaps.add('missing_preview_boundary_metadata');
  }

  return Array.from(gaps);
}

function classifyArenaVirtualSimulationRunRow(
  row: EvidenceCoverageRow,
  entry: EvidenceSourceCatalogEntry,
): EvidenceRowClassification {
  const provenance = inferProvenance(row);

  if (isNonRealProvenance(provenance)) {
    return {
      sourceId: entry.id,
      provenance,
      learningScope: entry.learningScope,
      valueLevel: entry.defaultValueLevel,
      eligibility: 'excluded',
      materializationReadiness: entry.materializationReadiness,
      exclusionReason: 'non_real_provenance',
    };
  }

  const readinessGaps = collectArenaPreviewReadinessGaps(row);
  if (readinessGaps.length > 0) {
    return {
      sourceId: entry.id,
      provenance,
      learningScope: entry.learningScope,
      valueLevel: 'context',
      eligibility: 'context-only',
      materializationReadiness: 'partial',
      exclusionReason: readinessGaps[0],
      readinessGaps,
    };
  }

  return {
    sourceId: entry.id,
    provenance,
    learningScope: entry.learningScope,
    valueLevel: entry.defaultValueLevel,
    eligibility: entry.defaultEligibility,
    materializationReadiness: entry.materializationReadiness,
  };
}

export function getEvidenceSourceCatalog(): EvidenceSourceCatalogEntry[] {
  return CATALOG.map((entry) => ({ ...entry, traceabilityFields: [...entry.traceabilityFields] }));
}

export function getProfileEligibleEvidenceSourceIds(): EvidenceSourceId[] {
  return CATALOG
    .filter((entry) => entry.defaultEligibility === 'eligible' && Boolean(entry.userIdField))
    .map((entry) => entry.id);
}

export function resolveInteractionLogEventType(row: Pick<EvidenceCoverageRow, 'eventType' | 'eventData'>): InteractionLogEventTypeResolution {
  const wrapperEventType = readString(row.eventType) ?? 'unknown';
  const payload = readRecord(row.eventData);
  const payloadEventType = readString(payload.eventType);

  if (payloadEventType) {
    return {
      canonicalEventType: payloadEventType,
      wrapperEventType,
      source: 'payload',
      missingPayloadEventType: false,
    };
  }

  return {
    canonicalEventType: wrapperEventType,
    wrapperEventType,
    source: 'wrapper',
    missingPayloadEventType: true,
  };
}

function classifyInteractionRow(row: EvidenceCoverageRow, entry: EvidenceSourceCatalogEntry): EvidenceRowClassification {
  const provenance = inferProvenance(row);
  const resolution = resolveInteractionLogEventType(row);
  const payload = readRecord(row.eventData);

  if (isNonRealProvenance(provenance)) {
    return {
      sourceId: entry.id,
      provenance,
      learningScope: entry.learningScope,
      valueLevel: entry.defaultValueLevel,
      eligibility: 'excluded',
      materializationReadiness: entry.materializationReadiness,
      canonicalEventType: resolution.canonicalEventType,
      wrapperEventType: resolution.wrapperEventType,
      exclusionReason: 'non_real_provenance',
    };
  }

  if (LOW_VALUE_INTERACTION_EVENTS.has(resolution.canonicalEventType)) {
    return {
      sourceId: entry.id,
      provenance,
      learningScope: entry.learningScope,
      valueLevel: 'low',
      eligibility: 'context-only',
      materializationReadiness: entry.materializationReadiness,
      canonicalEventType: resolution.canonicalEventType,
      wrapperEventType: resolution.wrapperEventType,
      exclusionReason: 'low_value_activity_context',
    };
  }

  if (resolution.canonicalEventType === 'workspace_param_change' && payload.sampled !== true) {
    return {
      sourceId: entry.id,
      provenance,
      learningScope: entry.learningScope,
      valueLevel: 'low',
      eligibility: 'context-only',
      materializationReadiness: entry.materializationReadiness,
      canonicalEventType: resolution.canonicalEventType,
      wrapperEventType: resolution.wrapperEventType,
      exclusionReason: 'unsampled_parameter_tick',
    };
  }

  if (HIGH_VALUE_INTERACTION_EVENTS.has(resolution.canonicalEventType) || resolution.canonicalEventType === 'workspace_param_change') {
    return {
      sourceId: entry.id,
      provenance,
      learningScope: entry.learningScope,
      valueLevel: resolution.canonicalEventType === 'workspace_param_change' ? 'medium' : 'high',
      eligibility: 'eligible',
      materializationReadiness: entry.materializationReadiness,
      canonicalEventType: resolution.canonicalEventType,
      wrapperEventType: resolution.wrapperEventType,
    };
  }

  return {
    sourceId: entry.id,
    provenance,
    learningScope: entry.learningScope,
    valueLevel: 'context',
    eligibility: 'unsupported',
    materializationReadiness: 'future',
    canonicalEventType: resolution.canonicalEventType,
    wrapperEventType: resolution.wrapperEventType,
    exclusionReason: resolution.missingPayloadEventType
      ? 'missing_canonical_payload_event_type'
      : 'unsupported_event_family',
  };
}

export function classifyEvidenceRow(row: EvidenceCoverageRow & { sourceId: EvidenceSourceId }): EvidenceRowClassification {
  const entry = CATALOG_BY_ID.get(row.sourceId);
  if (!entry) {
    return {
      sourceId: row.sourceId,
      provenance: 'unknown',
      learningScope: 'historical',
      valueLevel: 'context',
      eligibility: 'unsupported',
      materializationReadiness: 'future',
      exclusionReason: 'unknown_source',
    };
  }

  if (entry.id === 'InteractionLog') {
    return classifyInteractionRow(row, entry);
  }

  if (entry.id === 'ArenaVirtualSimulationRun') {
    return classifyArenaVirtualSimulationRunRow(row, entry);
  }

  const provenance = inferProvenance(row);
  if (isNonRealProvenance(provenance)) {
    return {
      sourceId: entry.id,
      provenance,
      learningScope: entry.learningScope,
      valueLevel: entry.defaultValueLevel,
      eligibility: 'excluded',
      materializationReadiness: entry.materializationReadiness,
      exclusionReason: 'non_real_provenance',
    };
  }

  if (entry.defaultEligibility === 'unsupported') {
    return {
      sourceId: entry.id,
      provenance,
      learningScope: entry.learningScope,
      valueLevel: entry.defaultValueLevel,
      eligibility: 'unsupported',
      materializationReadiness: entry.materializationReadiness,
      exclusionReason: 'source_not_profile_ready',
    };
  }

  return {
    sourceId: entry.id,
    provenance,
    learningScope: entry.learningScope,
    valueLevel: entry.defaultValueLevel,
    eligibility: entry.defaultEligibility,
    materializationReadiness: entry.materializationReadiness,
  };
}

function buildSampleReference(sourceId: EvidenceSourceId, id: string) {
  return `${sourceId}:${id}`;
}

export function buildEvidenceSourceCoverageReport(input: BuildEvidenceSourceCoverageReportInput): EvidenceSourceCoverageReport {
  const allAffectedUsers = new Set<string>();
  const exclusionBuckets = new Map<string, EvidenceCoverageExclusion & { users: Set<string> }>();
  const sources: EvidenceSourceCoverage[] = [];

  for (const entry of CATALOG) {
    const rows = input.rowsBySource[entry.id] ?? [];
    const affectedUsers = new Set<string>();
    const provenanceCounts: Partial<Record<EvidenceProvenance, number>> = {};
    const eligibilityCounts: Partial<Record<EvidenceEligibility, number>> = {};
    const valueLevelCounts: Partial<Record<EvidenceValueLevel, number>> = {};
    const readinessGapCounts: Record<string, number> = {};
    const timestamps: string[] = [];
    const samples: string[] = [];
    let eligibleRows = 0;
    let excludedRows = 0;
    let unsupportedRows = 0;
    let materializationReadiness = entry.materializationReadiness;

    for (const row of rows) {
      const userId = readString(row.userId);
      if (userId) {
        affectedUsers.add(userId);
        allAffectedUsers.add(userId);
      }

      const timestamp = normalizeDate(row.occurredAt);
      if (timestamp) timestamps.push(timestamp);
      if (samples.length < 5) samples.push(buildSampleReference(entry.id, row.id));

      const classification = classifyEvidenceRow({ ...row, sourceId: entry.id });
      increment(provenanceCounts, classification.provenance);
      increment(eligibilityCounts, classification.eligibility);
      increment(valueLevelCounts, classification.valueLevel);
      if (classification.materializationReadiness === 'partial') {
        materializationReadiness = 'partial';
      }
      for (const gap of classification.readinessGaps ?? []) {
        readinessGapCounts[gap] = (readinessGapCounts[gap] ?? 0) + 1;
      }

      if (classification.eligibility === 'eligible') {
        eligibleRows += 1;
      } else if (classification.eligibility === 'unsupported') {
        unsupportedRows += 1;
      } else {
        excludedRows += 1;
      }

      if (classification.exclusionReason) {
        const key = `${entry.id}:${classification.exclusionReason}`;
        const existing = exclusionBuckets.get(key) ?? {
          sourceId: entry.id,
          reason: classification.exclusionReason,
          rowCount: 0,
          affectedUsers: 0,
          sampleSourceReference: null,
          users: new Set<string>(),
        };
        existing.rowCount += 1;
        if (userId) existing.users.add(userId);
        existing.affectedUsers = existing.users.size;
        existing.sampleSourceReference ??= buildSampleReference(entry.id, row.id);
        exclusionBuckets.set(key, existing);
      }
    }

    const sortedTimestamps = [...timestamps].sort();
    sources.push({
      sourceId: entry.id,
      tableName: entry.tableName,
      learningScope: entry.learningScope,
      totalRows: rows.length,
      eligibleRows,
      excludedRows,
      unsupportedRows,
      affectedUsers: affectedUsers.size,
      firstObservedAt: sortedTimestamps[0] ?? null,
      lastObservedAt: sortedTimestamps[sortedTimestamps.length - 1] ?? null,
      provenanceCounts,
      eligibilityCounts,
      valueLevelCounts,
      materializationReadiness,
      readinessGapCounts,
      sampleSourceReferences: samples,
    });
  }

  const totals = sources.reduce(
    (accumulator, source) => ({
      totalRows: accumulator.totalRows + source.totalRows,
      eligibleRows: accumulator.eligibleRows + source.eligibleRows,
      excludedRows: accumulator.excludedRows + source.excludedRows,
      unsupportedRows: accumulator.unsupportedRows + source.unsupportedRows,
      affectedUsers: allAffectedUsers.size,
    }),
    {
      totalRows: 0,
      eligibleRows: 0,
      excludedRows: 0,
      unsupportedRows: 0,
      affectedUsers: 0,
    },
  );

  const exclusions = Array.from(exclusionBuckets.values())
    .map(({ users, ...entry }) => entry)
    .sort((left, right) => {
      if (left.sourceId !== right.sourceId) return left.sourceId.localeCompare(right.sourceId);
      return left.reason.localeCompare(right.reason);
    });

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    catalogVersion: CATALOG_VERSION,
    totals,
    sources,
    exclusions,
  };
}
