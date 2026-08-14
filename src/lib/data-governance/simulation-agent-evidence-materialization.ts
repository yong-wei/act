import type { Prisma } from '@prisma/client';

import {
  selectLearningFactAuthority,
  writeKnowledgeScopedLearningFacts,
  type LearningFactWriteRow,
} from '@/lib/canonical-learning-fact-identity';
import { resolveActiveKnowledgeRevision } from './knowledge-truth-revision';

type JsonRecord = Record<string, unknown>;

const SIMULATION_SUMMARY_METRIC_KEYS = [
  'trackingError',
  'maxDeviation',
  'worstCaseDeviation',
  'controlEnergy',
  'safetyViolations',
  'constraintViolations',
  'smoothness',
  'disturbanceRecovery',
  'identificationFit',
] as const;

const PREVIEW_REPLAY_CONFIDENCE_CAP = 0.45;

export type SimulationAgentEvidenceSourceType = 'simulation_run' | 'agent_tool_run';
export type SimulationAgentEvidenceReviewerState = 'auto_approved' | 'review_required' | 'approved';

export interface SimulationAgentEvidenceDraft {
  ownerUserId: string;
  sourceType: SimulationAgentEvidenceSourceType;
  sourceRefs: {
    simulationRunId?: string;
    simulationTraceId?: string;
    agentSessionId?: string;
    agentToolRunId?: string;
  };
  factType: string;
  summary: Prisma.InputJsonObject;
  evidenceRefs: Prisma.InputJsonObject;
  provenance: Prisma.InputJsonObject;
  confidence: number;
  privacyScope: 'student-visible' | 'teacher-scoped' | 'audit-only';
  dedupeKey: string;
  reviewerState: SimulationAgentEvidenceReviewerState;
  occurredAt: Date;
  courseId?: string;
  lessonId?: string;
  sessionId?: string;
  classId?: string;
}

export interface SimulationAgentEvidenceOutboxEvent {
  eventType: 'simulation_agent_evidence.draft_created';
  correlationId: string;
  causationId: string;
  ownerUserId: string;
  source: SimulationAgentEvidenceDraft['sourceRefs'];
  provenance: Prisma.InputJsonObject;
  privacyScope: SimulationAgentEvidenceDraft['privacyScope'];
  dedupeKey: string;
  createdAt: string;
}

export interface SimulationAgentEvidenceMaterializationInput {
  simulationRuns?: Array<{
    run: JsonRecord;
    trace?: JsonRecord | null;
  }>;
  agentToolRuns?: JsonRecord[];
  now?: Date;
}

export interface SimulationAgentEvidenceMaterializationResult {
  drafts: SimulationAgentEvidenceDraft[];
  outboxEvents: SimulationAgentEvidenceOutboxEvent[];
  learningFacts: Prisma.LearningFactCreateManyInput[];
}

type LearningFactCreateManyDelegate = {
  createMany(args: {
    data: Prisma.LearningFactCreateManyInput[];
    skipDuplicates?: boolean;
  }): Promise<{ count: number }>;
};

type EvidenceDraftCreateManyDelegate = {
  createMany(args: {
    data: Prisma.LearningEvidenceDraftCreateManyInput[];
    skipDuplicates?: boolean;
  }): Promise<{ count: number }>;
};

type EvidenceOutboxCreateManyDelegate = {
  createMany(args: {
    data: Prisma.EvidenceOutboxCreateManyInput[];
    skipDuplicates?: boolean;
  }): Promise<{ count: number }>;
};

export interface PersistSimulationAgentEvidenceResult extends SimulationAgentEvidenceMaterializationResult {
  created: number;
  skipped: boolean;
}

export function buildSimulationAgentEvidenceMaterialization(
  input: SimulationAgentEvidenceMaterializationInput,
): SimulationAgentEvidenceMaterializationResult {
  const now = input.now ?? new Date();
  const drafts = [
    ...(input.simulationRuns ?? []).flatMap(({ run, trace }) => {
      const draft = buildSimulationRunEvidenceDraft(run, trace ?? null, now);
      return draft ? [draft] : [];
    }),
    ...(input.agentToolRuns ?? []).flatMap((toolRun) => {
      const draft = buildAgentToolRunEvidenceDraft(toolRun, now);
      return draft ? [draft] : [];
    }),
  ];
  const learningFacts = drafts
    .map(draftToLearningFactInput)
    .filter((fact): fact is Prisma.LearningFactCreateManyInput => Boolean(fact));

  return {
    drafts,
    outboxEvents: drafts.map((draft) => draftToOutboxEvent(draft, now)),
    learningFacts,
  };
}

export async function persistSimulationAgentEvidenceMaterialization(
  db: {
    learningFact: LearningFactCreateManyDelegate;
    learningEvidenceDraft?: EvidenceDraftCreateManyDelegate;
    evidenceOutbox?: EvidenceOutboxCreateManyDelegate;
  },
  input: SimulationAgentEvidenceMaterializationInput,
): Promise<PersistSimulationAgentEvidenceResult> {
  const result = buildSimulationAgentEvidenceMaterialization(input);
  await db.learningEvidenceDraft?.createMany({
    data: result.drafts.map(draftToDraftRow),
    skipDuplicates: true,
  });
  await db.evidenceOutbox?.createMany({
    data: result.outboxEvents.map(outboxEventToRow),
    skipDuplicates: true,
  });
  if (result.learningFacts.length === 0) {
    return {
      ...result,
      created: 0,
      skipped: true,
    };
  }

  const selector = selectLearningFactAuthority('FORMAL_PRODUCTION');
  const activeRevision = await resolveActiveKnowledgeRevision(db as never);
  const created = await writeKnowledgeScopedLearningFacts(
    {
      learningFact: {
        createMany: async (args) => db.learningFact.createMany({
          data: [...args.data] as Prisma.LearningFactCreateManyInput[],
          skipDuplicates: args.skipDuplicates,
        }),
      },
    },
    {
      rows: result.learningFacts as LearningFactWriteRow[],
      knowledgeScoped: true,
    },
    {
      selector,
      knowledgeRevisionRef: activeRevision.id,
    },
  );

  return {
    ...result,
    created: created.written,
    skipped: created.written === 0,
  };
}

function buildSimulationRunEvidenceDraft(
  run: JsonRecord,
  trace: JsonRecord | null,
  now: Date,
): SimulationAgentEvidenceDraft | null {
  const runId = readString(run.id);
  const ownerUserId = readString(run.ownerUserId);
  if (!runId || !ownerUserId || !isCompletedStatus(run.status)) return null;

  const summary = readObject(run.summary);
  const traceId = readString(trace?.id);
  const summaryProvenance = readObject(summary.provenance);
  const agentSessionId = readString(summary.agentSessionId) ?? readString(summaryProvenance.agentSessionId);
  const agentToolRunId = readString(summary.agentToolRunId) ?? readString(summaryProvenance.agentToolRunId);
  const protocolVersion = readString(run.protocolVersion) ?? 'unknown';
  const preview = isPreviewRun(run, summary);
  const provenance = compactObject({
    sourceDomain: readString(run.sourceDomain),
    runKind: readString(run.runKind),
    preview,
    official: preview ? false : isOfficialRun(run, summary),
    courseLaunched: isCourseLaunchedRun(run),
    standalone: !isCourseLaunchedRun(run),
    agentAssisted: runIsAgentAssisted(run, summary),
  });
  const safeSummary = preview
    ? forcePreviewBoundary(buildSafeSimulationSummary(summary, trace))
    : buildSafeSimulationSummary(summary, trace);
  const privacyScope = readString(run.classId) ? 'student-visible' : 'student-visible';
  const occurredAt = readDate(run.completedAt) ?? readDate(run.startedAt) ?? now;
  const dedupeKey = `simulation_run:${runId}:${protocolVersion}`;

  return {
    ownerUserId,
    sourceType: 'simulation_run',
    sourceRefs: compactObject({
      simulationRunId: runId,
      simulationTraceId: traceId,
      agentSessionId,
      agentToolRunId,
    }),
    factType: 'simulation',
    summary: safeSummary,
    evidenceRefs: compactObject({
      simulationRunId: runId,
      simulationTraceId: traceId,
      agentSessionId,
      agentToolRunId,
      taskSpecId: readString(run.taskSpecId),
      taskId: readString(safeSummary.taskId),
      traceReference: traceId ? `SimulationTrace:${traceId}` : `SimulationRun:${runId}`,
    }),
    provenance,
    confidence: resolveSimulationConfidence(summary, trace, preview),
    privacyScope,
    dedupeKey,
    reviewerState: 'auto_approved',
    occurredAt,
    courseId: readString(run.courseId),
    sessionId: readString(run.sessionId),
    classId: readString(run.classId),
  };
}

function buildAgentToolRunEvidenceDraft(
  toolRun: JsonRecord,
  now: Date,
): SimulationAgentEvidenceDraft | null {
  const toolRunId = readString(toolRun.id);
  const ownerUserId = readString(toolRun.ownerUserId);
  if (!toolRunId || !ownerUserId || !isCompletedStatus(toolRun.status)) return null;

  const output = readObject(toolRun.outputSummary);
  const input = readObject(toolRun.inputSummary);
  const simulationRunId = readString(output.simulationRunId) ?? readString(input.simulationRunId);
  const traceRef = readObject(output.traceRef);
  const idempotencyKey = readString(toolRun.idempotencyKey) ?? toolRunId;
  const approved = readString(toolRun.approvalState) === 'approved';
  const deterministicMetrics = buildAgentToolDeterministicMetrics(output);
  const modelAuthored = Boolean(readString(output.narrative) || readString(output.analysis) || readString(output.rationale));

  return {
    ownerUserId,
    sourceType: 'agent_tool_run',
    sourceRefs: compactObject({
      agentSessionId: readString(toolRun.agentSessionId),
      agentToolRunId: toolRunId,
      simulationRunId,
      simulationTraceId: readString(traceRef.traceId),
    }),
    factType: 'ai_intervention',
    summary: compactObject({
      toolName: readString(toolRun.toolName),
      deterministicMetrics,
      narrativeKind: modelAuthored ? 'model-authored' : undefined,
    }),
    evidenceRefs: compactObject({
      agentToolRunId: toolRunId,
      agentSessionId: readString(toolRun.agentSessionId),
      simulationRunId,
      traceReference: readString(traceRef.traceId) ? `SimulationTrace:${readString(traceRef.traceId)}` : undefined,
    }),
    provenance: compactObject({
      agentAssisted: true,
      modelAuthored,
      toolName: readString(toolRun.toolName),
      permissionTier: readString(toolRun.permissionTier),
    }),
    confidence: approved && Object.keys(deterministicMetrics).length > 0 ? 0.65 : 0.35,
    privacyScope: 'student-visible',
    dedupeKey: `agent_tool_run:${toolRunId}:${idempotencyKey}`,
    reviewerState: approved && Object.keys(deterministicMetrics).length > 0 ? 'approved' : 'review_required',
    occurredAt: readDate(toolRun.completedAt) ?? readDate(toolRun.startedAt) ?? now,
    courseId: readString(toolRun.courseId),
    sessionId: readString(toolRun.agentSessionId),
    classId: readString(toolRun.classId),
  };
}

function buildAgentToolDeterministicMetrics(output: JsonRecord): Prisma.InputJsonObject {
  const metrics = { ...readObject(output.metrics) };
  const interventionOutcome = resolveAgentToolInterventionOutcome(output);
  if (interventionOutcome !== undefined && readNumber(metrics.interventionOutcome) === undefined) {
    metrics.interventionOutcome = interventionOutcome;
  }
  return sanitizeObject(metrics);
}

function resolveAgentToolInterventionOutcome(output: JsonRecord): number | undefined {
  const outcome = readObject(output.outcome);
  const feedback = readString(outcome.feedback);
  if (!feedback) return undefined;

  if (typeof outcome.helpful === 'boolean') {
    return outcome.helpful ? 1 : 0.25;
  }
  if (feedback === 'accepted') return 0.85;
  if (feedback === 'rated') return 0.6;
  if (feedback === 'dismissed') return 0.1;
  return undefined;
}

function draftToLearningFactInput(
  draft: SimulationAgentEvidenceDraft,
): Prisma.LearningFactCreateManyInput | null {
  if (draft.reviewerState === 'review_required') return null;

  return {
    userId: draft.ownerUserId,
    factType: draft.factType,
    moduleId: readString(draft.summary.sourceId) ??
      readString(draft.summary.taskId) ??
      readString(draft.evidenceRefs.taskSpecId),
    sessionId: draft.sessionId,
    startedAt: draft.occurredAt,
    finishedAt: draft.occurredAt,
    outcome: resolveFactOutcome(draft),
    score: readNumber(draft.summary.score),
    timeSpent: resolveFactTimeSpent(draft),
    competencyContribution: resolveCompetencyContribution(draft),
    sourceEventId: `simulation-agent-evidence:${draft.dedupeKey}`,
    sourceLogId: draft.sourceType === 'simulation_run'
      ? `SimulationRun:${draft.sourceRefs.simulationRunId}`
      : `AgentToolRun:${draft.sourceRefs.agentToolRunId}`,
    courseId: draft.courseId,
    contextJson: compactObject({
      classId: draft.classId,
      simulation: draft.sourceType === 'simulation_run'
        ? compactObject({
            runId: draft.sourceRefs.simulationRunId,
            traceReference: readString(draft.evidenceRefs.traceReference),
            summary: draft.summary,
            replayConfidence: draft.confidence,
            agentAssisted: draft.provenance.agentAssisted === true,
            preview: draft.provenance.preview === true,
            official: draft.provenance.official === true,
            taskId: readString(draft.summary.taskId),
            scenarioId: readString(draft.summary.scenarioId),
            evaluationVisibility: readString(draft.summary.evaluationVisibility),
            officialEligible: readBoolean(draft.summary.officialEligible),
            arenaTraining: Object.keys(readObject(draft.summary.arenaTraining)).length > 0
              ? readObject(draft.summary.arenaTraining)
              : undefined,
            launchMode: draft.provenance.standalone === true ? 'standalone' : 'course-resource',
            governanceContext: compactObject({
              classId: draft.classId,
              privacyScope: draft.privacyScope,
              reviewerState: draft.reviewerState,
              dedupeKey: draft.dedupeKey,
            }),
          })
        : undefined,
      agentTool: draft.sourceType === 'agent_tool_run'
        ? compactObject({
            agentToolRunId: draft.sourceRefs.agentToolRunId,
            agentSessionId: draft.sourceRefs.agentSessionId,
            simulationRunId: draft.sourceRefs.simulationRunId,
            traceReference: readString(draft.evidenceRefs.traceReference),
            agentAssisted: true,
            deterministicMetrics: readObject(draft.summary.deterministicMetrics),
            interventionOutcome: readNumber(readObject(draft.summary.deterministicMetrics).interventionOutcome),
            reviewerState: draft.reviewerState,
            confidence: draft.confidence,
            governanceContext: compactObject({
              classId: draft.classId,
              privacyScope: draft.privacyScope,
              reviewerState: draft.reviewerState,
              dedupeKey: draft.dedupeKey,
            }),
          })
        : undefined,
      evidenceDraft: compactObject({
        sourceType: draft.sourceType,
        sourceRefs: draft.sourceRefs,
        reviewerState: draft.reviewerState,
        dedupeKey: draft.dedupeKey,
        privacyScope: draft.privacyScope,
      }),
      evidenceOutbox: compactObject({
        eventType: 'simulation_agent_evidence.draft_created',
        causationId: draft.sourceType === 'simulation_run'
          ? `SimulationRun:${draft.sourceRefs.simulationRunId}`
          : `AgentToolRun:${draft.sourceRefs.agentToolRunId}`,
        dedupeKey: draft.dedupeKey,
      }),
      evidenceGovernance: compactObject({
        evidenceQuality: 'partial',
        profileWeight: 0,
        skipProfileContribution: true,
        policyReason: 'unmanaged_learning_fact_context_only',
        sourceType: draft.sourceType,
        privacyScope: draft.privacyScope,
        confidence: draft.confidence,
        provenance: draft.provenance,
      }),
    }),
  };
}

function draftToDraftRow(draft: SimulationAgentEvidenceDraft): Prisma.LearningEvidenceDraftCreateManyInput {
  return {
    ownerUserId: draft.ownerUserId,
    sourceType: draft.sourceType,
    sourceRefs: draft.sourceRefs,
    factType: draft.factType,
    summary: draft.summary,
    evidenceRefs: draft.evidenceRefs,
    provenance: draft.provenance,
    confidence: draft.confidence,
    privacyScope: draft.privacyScope,
    dedupeKey: draft.dedupeKey,
    reviewerState: draft.reviewerState,
    occurredAt: draft.occurredAt,
    courseId: draft.courseId ?? null,
    sessionId: draft.sessionId ?? null,
    classId: draft.classId ?? null,
  };
}

function outboxEventToRow(event: SimulationAgentEvidenceOutboxEvent): Prisma.EvidenceOutboxCreateManyInput {
  return {
    eventType: event.eventType,
    correlationId: event.correlationId,
    causationId: event.causationId,
    ownerUserId: event.ownerUserId,
    payload: {
      source: event.source,
      provenance: event.provenance,
      privacyScope: event.privacyScope,
      dedupeKey: event.dedupeKey,
    },
    dedupeKey: event.dedupeKey,
    createdAt: event.createdAt,
  };
}

function draftToOutboxEvent(
  draft: SimulationAgentEvidenceDraft,
  now: Date,
): SimulationAgentEvidenceOutboxEvent {
  const primaryId = draft.sourceType === 'simulation_run'
    ? draft.sourceRefs.simulationRunId ?? draft.dedupeKey
    : draft.sourceRefs.agentToolRunId ?? draft.dedupeKey;
  const primaryKind = draft.sourceType === 'simulation_run' ? 'SimulationRun' : 'AgentToolRun';
  return {
    eventType: 'simulation_agent_evidence.draft_created',
    correlationId: draft.sourceType === 'agent_tool_run'
      ? readString(draft.sourceRefs.agentToolRunId) ?? draft.dedupeKey
      : `simulation-run:${primaryId}`,
    causationId: `${primaryKind}:${primaryId}`,
    ownerUserId: draft.ownerUserId,
    source: draft.sourceRefs,
    provenance: draft.provenance,
    privacyScope: draft.privacyScope,
    dedupeKey: draft.dedupeKey,
    createdAt: now.toISOString(),
  };
}

function buildSafeSimulationSummary(summary: JsonRecord, trace: JsonRecord | null): Prisma.InputJsonObject {
  const metrics = resolveSimulationSummaryMetrics(summary);
  const arenaTraining = buildSafeArenaTrainingSummary(summary);
  return compactObject({
    score: readNumber(summary.score) ?? deriveSimulationSummaryScore(metrics),
    valid: typeof summary.valid === 'boolean' ? summary.valid : deriveSimulationSummaryValid(metrics),
    replayConfidence: readNumber(summary.replayConfidence),
    durationSeconds: readNumber(summary.durationSeconds),
    taskId: readString(arenaTraining.taskId),
    scenarioId: readString(arenaTraining.scenarioId),
    evaluationVisibility: readString(arenaTraining.evaluationVisibility),
    officialEligible: readBoolean(arenaTraining.officialEligible),
    arenaTraining: Object.keys(arenaTraining).length > 0 ? arenaTraining : undefined,
    metrics,
    satisfaction: sanitizeObject(readObject(summary.satisfaction)),
    weakMetrics: sanitizeArray(summary.weakMetrics),
    trace: trace ? compactObject({
      protocolVersion: readString(trace.protocolVersion),
      checksum: readString(trace.checksum),
      sampleCount: readNumber(trace.sampleCount),
      sampleCadence: readNumber(trace.sampleCadence),
      summaryMetrics: sanitizeObject(readObject(trace.summaryMetrics)),
    }) : undefined,
  });
}

function buildSafeArenaTrainingSummary(summary: JsonRecord): Prisma.InputJsonObject {
  const arenaTraining = readObject(summary.arenaTraining);
  const previewBoundary = readObject(summary.previewBoundary);
  const replay = readObject(arenaTraining.replay);

  return compactObject({
    taskId: readString(arenaTraining.taskId),
    scenarioId: readString(arenaTraining.scenarioId),
    evaluationVisibility: readString(arenaTraining.evaluationVisibility) ?? readString(previewBoundary.evaluationVisibility),
    officialEligible: readBoolean(arenaTraining.officialEligible) ?? readBoolean(previewBoundary.officialEligible),
    replay: Object.keys(replay).length > 0
      ? compactObject({
          sceneId: readString(replay.sceneId),
          scenarioId: readString(replay.scenarioId),
          checksum: readString(replay.checksum),
          protocolVersion: readString(replay.protocolVersion),
        })
      : undefined,
  });
}

function forcePreviewBoundary(summary: Prisma.InputJsonObject): Prisma.InputJsonObject {
  const existingArenaTraining = readObject(summary.arenaTraining);
  const arenaTraining = compactObject({
    ...existingArenaTraining,
    evaluationVisibility: 'preview',
    officialEligible: false,
  });
  return compactObject({
    ...summary,
    evaluationVisibility: 'preview',
    officialEligible: false,
    arenaTraining,
  });
}

function resolveSimulationSummaryMetrics(summary: JsonRecord): Prisma.InputJsonObject {
  const metrics = { ...readObject(summary.metrics) };
  for (const key of SIMULATION_SUMMARY_METRIC_KEYS) {
    const value = readNumber(summary[key]);
    if (value !== undefined && readNumber(metrics[key]) === undefined) {
      metrics[key] = value;
    }
  }
  return sanitizeObject(metrics);
}

function deriveSimulationSummaryScore(metrics: Prisma.InputJsonObject): number | undefined {
  const trackingError = readNumber(metrics.trackingError);
  const maxDeviation = readNumber(metrics.maxDeviation) ?? readNumber(metrics.worstCaseDeviation);
  const safetyViolations = readNumber(metrics.safetyViolations) ?? readNumber(metrics.constraintViolations);
  if (trackingError === undefined && maxDeviation === undefined && safetyViolations === undefined) {
    return undefined;
  }

  return clampScore(
    100 -
      (trackingError ?? 0) * 70 -
      (maxDeviation ?? 0) * 12 -
      (safetyViolations ?? 0) * 4,
  );
}

function deriveSimulationSummaryValid(metrics: Prisma.InputJsonObject): boolean | undefined {
  const safetyViolations = readNumber(metrics.safetyViolations) ?? readNumber(metrics.constraintViolations);
  return safetyViolations === undefined ? undefined : safetyViolations === 0;
}

function resolveFactOutcome(draft: SimulationAgentEvidenceDraft): string {
  if (draft.summary.valid === false) return 'partial';
  const score = readNumber(draft.summary.score);
  if (score === undefined) return 'partial';
  return score >= 60 ? 'success' : 'partial';
}

function resolveFactTimeSpent(draft: SimulationAgentEvidenceDraft): number | undefined {
  const durationSeconds = readNumber(draft.summary.durationSeconds);
  if (durationSeconds === undefined) return undefined;
  return Math.max(0, Math.round(durationSeconds));
}

function resolveCompetencyContribution(draft: SimulationAgentEvidenceDraft): Prisma.InputJsonValue {
  if (draft.provenance.preview === true && !hasCompletePreviewAttribution(draft.summary)) {
    return {
      parameterDesign: 0,
      systemAnalysis: 0,
    };
  }
  const score = readNumber(draft.summary.score);
  const baseContribution = score === undefined ? 0.2 : Math.max(Math.min((score - 50) / 100, 0.6), -0.3);
  const contribution = draft.provenance.preview === true ? baseContribution * 0.33 : baseContribution;
  return {
    parameterDesign: round(contribution),
    systemAnalysis: round(contribution * 0.8),
  };
}

function hasCompletePreviewAttribution(summary: Prisma.InputJsonObject): boolean {
  const trace = readObject(summary.trace);
  return readString(summary.taskId) !== undefined
    && readString(summary.scenarioId) !== undefined
    && readString(summary.evaluationVisibility) === 'preview'
    && readBoolean(summary.officialEligible) === false
    && readString(trace.checksum) !== undefined
    && readString(trace.protocolVersion) !== undefined;
}

function resolveSimulationConfidence(
  summary: JsonRecord,
  trace: JsonRecord | null,
  preview: boolean,
): number {
  const explicit = readNumber(summary.replayConfidence);
  if (preview) {
    return explicit === undefined
      ? PREVIEW_REPLAY_CONFIDENCE_CAP
      : Math.min(clamp01(explicit), PREVIEW_REPLAY_CONFIDENCE_CAP);
  }
  if (explicit !== undefined) return clamp01(explicit);
  if (trace && readString(trace.checksum) && readString(trace.protocolVersion)) return 0.8;
  return PREVIEW_REPLAY_CONFIDENCE_CAP;
}

function isPreviewRun(run: JsonRecord, summary: JsonRecord = {}): boolean {
  return readString(run.runKind)?.includes('preview') === true ||
    readString(run.sourceDomain)?.includes('preview') === true ||
    readString(readObject(summary.arenaTraining).evaluationVisibility) === 'preview' ||
    readString(readObject(summary.previewBoundary).evaluationVisibility) === 'preview';
}

function isOfficialRun(run: JsonRecord, summary: JsonRecord): boolean {
  return readString(run.runKind)?.includes('official') === true ||
    summary.official === true ||
    summary.evaluationMode === 'official';
}

function isCourseLaunchedRun(run: JsonRecord): boolean {
  return Boolean(readString(run.courseId) || readString(run.sessionId) || readString(run.publicationId));
}

function runIsAgentAssisted(run: JsonRecord, summary: JsonRecord): boolean {
  return summary.agentAssisted === true ||
    readString(run.sourceDomain)?.includes('konling') === true ||
    readString(run.sourceRefId)?.startsWith('konling:') === true;
}

function isCompletedStatus(value: unknown): boolean {
  return value === 'completed' || value === 'succeeded' || value === 'success';
}

function readObject(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function compactObject(value: JsonRecord): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Prisma.InputJsonObject;
}

function sanitizeObject(value: JsonRecord): Prisma.InputJsonObject {
  const blocked = new Set(['samples', 'rawSamples', 'sampleStorageUri']);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, entry]) => !blocked.has(key) && entry !== undefined)
      .map(([key, entry]) => [key, Array.isArray(entry) ? sanitizeArray(entry) : readObjectOrValue(entry)]),
  ) as Prisma.InputJsonObject;
}

function sanitizeArray(value: unknown): Prisma.InputJsonArray | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((entry) => readObject(entry))
    .filter((entry) => Object.keys(entry).length > 0)
    .map((entry) => sanitizeObject(entry)) as Prisma.InputJsonArray;
}

function readObjectOrValue(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return sanitizeObject(value as JsonRecord);
  }
  return value;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, round(value)));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
