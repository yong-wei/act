import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { eventRateLimiter } from '@/lib/rate-limiter';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import type { ClassroomInteractionEventInput } from '@/lib/classroom-analytics/types';
import { toLearningEvent } from '@/lib/data-governance/event-protocol';
import { routeEvent } from '@/lib/data-governance/event-buffer';
import { isCoreEvent } from '@/lib/data-governance/event-types';
import { resolveCanonicalEventType } from '@/lib/data-governance/event-normalization';
import { persistCoreLearningFact } from '@/lib/data-governance/learning-fact-materialization';
import { generateSessionSummaryReports } from '@/lib/data-governance/session-reports';
import { enqueueSessionSummaryReportRefresh } from '@/lib/data-governance/session-finalization-snapshots';
import {
  attachSourceLogIds,
  normalizeInteractionContexts,
  resolveClientEventId,
} from '@/lib/data-governance/interactive-event-ingestion';
import {
  resolveSubmissionPayloadEvidenceQuality,
  summarizeSubmissionEvidencePayload,
} from '@/lib/data-governance/submission-evidence-quality';
import type { NormalizedInteractionEvent } from '@/lib/data-governance/interactive-event-ingestion';
import type { PageType } from '@/lib/data-governance/event-protocol';
import {
  buildControlWorkbenchTeacherDiagnostics,
  materializeControlWorkbenchEvidenceFromSubmissionPayload,
  type ControlWorkbenchDiagnosticEvent,
} from '@/features/interactive/shared/manifest-runtime/control-workbench-evidence';
import {
  annotatedMediaDiagnosticEventFromEvidence,
  buildAnnotatedMediaTeacherDiagnostics,
  materializeAnnotatedMediaEvidenceFromSubmissionPayload,
  type AnnotatedMediaDiagnosticEvent,
} from '@/features/interactive/shared/manifest-runtime/annotated-media-evidence';
import {
  materializeControlWorkbenchTaskEvidence,
  materializeVirtualSimulationTaskEvidence,
} from '@/lib/data-governance/simulation-task-materialization';
import { persistAcceptedSimulationTaskEvidence } from '@/lib/data-governance/simulation-task-learning-fact';
import { hashSemanticFingerprintValue } from '@/lib/data-governance/simulation-task-evidence';

export const dynamic = 'force-dynamic';

function toDateTime(value: number | string | null | undefined): Date | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
}

/**
 * 验证 resourceId 是否合法
 * - 合法的resourceId必须是cuid格式（25个字符，以c开头）或null/undefined
 * - 返回null表示不合法，应该丢弃或降级处理
 */
function validateResourceId(resourceId: string | null | undefined): string | null {
  if (!resourceId) return null;

  // CUID格式校验: 以c开头，后跟24个字母数字字符，共25字符
  const cuidRegex = /^c[\w]{24}$/;
  if (cuidRegex.test(resourceId)) {
    return resourceId;
  }

  // 其他可能的合法格式（如特定的key格式）
  // resourceKey通常使用下划线分隔的格式，不是CUID
  return null;
}

/**
 * 降级日志 - 记录不合法的事件到控制台，不入库
 * 用于排查前端问题，避免数据库外键错误
 */
function logDegradedEvent(
  userId: string,
  event: ClassroomInteractionEventInput,
  reason: string
): void {
  console.warn('[InteractionLog Degraded]', {
    userId,
    reason,
    eventType: event.type,
    resourceId: event.resourceId,
    resourceKey: event.resourceKey,
    timestamp: event.timestamp,
  });
}

function resolvePagePath(payload: Record<string, unknown>) {
  return typeof payload.originPath === 'string' && payload.originPath.trim().length > 0
    ? payload.originPath
    : '/unknown';
}

function resolvePageType(payload: Record<string, unknown>): PageType {
  const pageType = typeof payload.pageType === 'string' ? payload.pageType : null;
  if (
    pageType === 'theory'
    || pageType === 'practice'
    || pageType === 'workspace'
    || pageType === 'quiz'
    || pageType === 'reflection'
    || pageType === 'simulation'
    || pageType === 'resource'
    || pageType === 'knowledge'
    || pageType === 'dashboard'
    || pageType === 'classroom'
  ) {
    return pageType;
  }
  return 'dashboard';
}

function normalizeActorRole(role: unknown) {
  const value = String(role ?? '').toLowerCase();
  if (value.includes('teacher') || value.includes('admin') || value.includes('教师') || value.includes('管理员')) {
    return 'teacher';
  }
  return 'student';
}

function applyServerActorRole(
  event: ClassroomInteractionEventInput,
  actorRole: string,
): ClassroomInteractionEventInput {
  const data = event.data && typeof event.data === 'object' ? event.data : {};
  return {
    ...event,
    actorRole,
    data: {
      ...data,
      actorRole,
      ...(data.eventType && data.sessionId
        ? {
            dedupeIdentity: [
              data.sessionId,
              data.eventType,
              actorRole,
              data.cardId ?? data.stepId ?? 'session',
              data.clientEventId ?? event.id ?? event.timestamp,
            ].join(':'),
          }
        : {}),
    },
  };
}

function withTrustedActorRole(value: unknown, actorRole: string): unknown {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      const trusted = withTrustedActorRole(parsed, actorRole);
      return JSON.stringify(trusted);
    } catch {
      return value;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  return {
    ...(value as Record<string, unknown>),
    actorRole,
  };
}

function trustNestedEvidenceActorRoles(
  payload: Record<string, unknown>,
  actorRole: string,
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...payload,
    actorRole,
  };

  if ('controlWorkbenchEvidenceDraft' in next) {
    next.controlWorkbenchEvidenceDraft = withTrustedActorRole(next.controlWorkbenchEvidenceDraft, actorRole);
  }
  if ('annotatedMediaEvidenceDraft' in next) {
    next.annotatedMediaEvidenceDraft = withTrustedActorRole(next.annotatedMediaEvidenceDraft, actorRole);
  }

  for (const key of ['answerDigest', 'answers']) {
    const source = next[key];
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      continue;
    }
    next[key] = Object.fromEntries(
      Object.entries(source as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        withTrustedActorRole(entryValue, actorRole),
      ]),
    );
  }

  return next;
}

function readJsonString(payload: Prisma.JsonValue, key: string): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const value = payload[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readPayloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readFirstQuestionCardId(payload: Record<string, unknown>): string | null {
  const summaries = payload.questionSummaries;
  if (!Array.isArray(summaries)) return null;
  for (const summary of summaries) {
    const record = readRecord(summary);
    const cardId = readPayloadString(record, 'cardId')
      ?? readPayloadString(record, 'questionId')
      ?? readPayloadString(record, 'id');
    if (cardId) return cardId;
  }
  return null;
}

function resolveSubmissionIdentity(payload: Record<string, unknown>, attemptKey: string | null | undefined): string | null {
  return attemptKey
    ?? readPayloadString(payload, 'submissionIdentity')
    ?? readPayloadString(payload, 'submissionId')
    ?? readPayloadString(payload, 'attemptId');
}

function buildClassroomSubmissionDedupeKey(input: {
  userId: string;
  sessionId: string | null | undefined;
  lessonKey: string | null | undefined;
  stepId: string | null | undefined;
  attemptKey: string | null | undefined;
  payload: Record<string, unknown>;
}): string | null {
  if (!input.sessionId || !input.stepId) return null;
  const submissionIdentity = resolveSubmissionIdentity(input.payload, input.attemptKey);
  if (!submissionIdentity) return null;
  const cardId = readPayloadString(input.payload, 'cardId')
    ?? readPayloadString(input.payload, 'questionId')
    ?? readFirstQuestionCardId(input.payload)
    ?? 'step';
  return [
    input.userId,
    input.sessionId,
    input.lessonKey ?? '',
    input.stepId,
    cardId,
    submissionIdentity,
  ].join('|');
}

function buildClassroomSubmissionDedupeKeyForEvent(eventData: NormalizedInteractionEvent, userId: string): string | null {
  const payload =
    eventData.event.data && typeof eventData.event.data === 'object'
      ? eventData.event.data
      : {};
  const canonicalEventType = resolveCanonicalEventType(eventData.event.type, payload);
  if (canonicalEventType !== 'lesson_submit' && canonicalEventType !== 'lesson_resubmit') {
    return null;
  }
  return buildClassroomSubmissionDedupeKey({
    userId,
    sessionId: eventData.sessionId,
    lessonKey: eventData.event.lessonKey ?? null,
    stepId: eventData.event.stepId ?? readPayloadString(payload, 'stepId'),
    attemptKey: eventData.event.attemptKey ?? readPayloadString(payload, 'attemptKey'),
    payload,
  });
}

function buildClassroomSubmissionDedupeKeyForResponse(response: {
  userId: string;
  sessionId: string;
  lessonKey: string | null;
  stepId: string;
  attemptKey: string | null;
  responseData: Prisma.JsonValue;
}): string | null {
  return buildClassroomSubmissionDedupeKey({
    userId: response.userId,
    sessionId: response.sessionId,
    lessonKey: response.lessonKey,
    stepId: response.stepId,
    attemptKey: response.attemptKey,
    payload: readRecord(response.responseData),
  });
}

function withSubmissionEvidenceQuality(
  payload: Record<string, unknown>,
  canonicalEventType: string,
): Record<string, unknown> {
  const evidenceQuality = resolveSubmissionPayloadEvidenceQuality(payload, canonicalEventType);
  if (!evidenceQuality) return payload;
  const summary = summarizeSubmissionEvidencePayload(payload);
  return {
    ...payload,
    evidenceQuality,
    evidenceQualityReason: summary.reason,
    evidenceSourceState: summary.sourceState,
  };
}

async function dedupeClassroomSubmissionEvents(
  events: NormalizedInteractionEvent[],
  userId: string,
): Promise<{ events: NormalizedInteractionEvent[]; duplicateSubmissionEvents: number }> {
  const candidateKeys = events
    .map((event) => buildClassroomSubmissionDedupeKeyForEvent(event, userId))
    .filter((key): key is string => Boolean(key));
  if (candidateKeys.length === 0) {
    return { events, duplicateSubmissionEvents: 0 };
  }

  const sessionIds = Array.from(new Set(events.map((event) => event.sessionId).filter((value): value is string => Boolean(value))));
  const stepIds = Array.from(new Set(events.map((event) => (
    event.event.stepId ?? readPayloadString(readRecord(event.event.data), 'stepId')
  )).filter((value): value is string => Boolean(value))));
  const existingResponses = sessionIds.length > 0 && stepIds.length > 0
    ? await prisma.studentStepResponse.findMany({
      where: {
        userId,
        sessionId: { in: sessionIds },
        stepId: { in: stepIds },
      },
      select: {
        userId: true,
        sessionId: true,
        lessonKey: true,
        stepId: true,
        attemptKey: true,
        responseData: true,
      },
    })
    : [];
  const seenKeys = new Set(
    existingResponses
      .map(buildClassroomSubmissionDedupeKeyForResponse)
      .filter((key): key is string => Boolean(key)),
  );
  const dedupedEvents: NormalizedInteractionEvent[] = [];
  let duplicateSubmissionEvents = 0;

  for (const event of events) {
    const key = buildClassroomSubmissionDedupeKeyForEvent(event, userId);
    if (key && seenKeys.has(key)) {
      duplicateSubmissionEvents += 1;
      continue;
    }
    if (key) seenKeys.add(key);
    dedupedEvents.push(event);
  }

  return { events: dedupedEvents, duplicateSubmissionEvents };
}

function buildStudentStepResponseRows(
  events: NormalizedInteractionEvent[],
  userId: string,
  serverRecordedAt: Date,
): Prisma.StudentStepResponseCreateManyInput[] {
  const rows: Prisma.StudentStepResponseCreateManyInput[] = [];

  for (const eventData of events) {
    const payload =
      eventData.event.data && typeof eventData.event.data === 'object'
        ? eventData.event.data
        : {};
    const canonicalEventType = resolveCanonicalEventType(eventData.event.type, payload);
    const trustedActorRole = eventData.event.actorRole ?? 'student';
    const normalizedPayload = trustNestedEvidenceActorRoles(
      withSubmissionEvidenceQuality(payload, canonicalEventType),
      trustedActorRole,
    );

    if (canonicalEventType !== 'lesson_submit' && canonicalEventType !== 'lesson_resubmit') {
      continue;
    }

    const sessionId = eventData.sessionId;
    const stepId = eventData.event.stepId ?? readPayloadString(payload, 'stepId');
    const sourceLogId = readPayloadString(payload, 'sourceLogId');
    const submittedAt = toDateTime(eventData.event.clientEventAt ?? eventData.event.timestamp);

    if (!sessionId || !stepId || !sourceLogId || !submittedAt) {
      continue;
    }

    const clientEventId = resolveClientEventId(eventData.event);
    const controlWorkbenchEvidence = materializeControlWorkbenchEvidenceFromSubmissionPayload(
      normalizedPayload,
      {
        trustedSourceLogId: sourceLogId,
        serverRecordedAt: serverRecordedAt.toISOString(),
      },
    );
    const annotatedMediaEvidence = materializeAnnotatedMediaEvidenceFromSubmissionPayload(
      normalizedPayload,
      {
        trustedSourceLogId: sourceLogId,
        serverRecordedAt: serverRecordedAt.toISOString(),
      },
    );

    rows.push({
      userId,
      sessionId,
      lessonKey: eventData.event.lessonKey ?? null,
      stepId,
      attemptKey: eventData.event.attemptKey ?? readPayloadString(payload, 'attemptKey'),
      sourceLogId,
      clientEventId,
      submittedAt,
      responseData: {
        ...normalizedPayload,
        ...(controlWorkbenchEvidence ? { controlWorkbenchEvidence } : {}),
        ...(annotatedMediaEvidence ? { annotatedMediaEvidence } : {}),
        eventType: canonicalEventType,
        resourceKey: eventData.event.resourceKey,
        lessonKey: eventData.event.lessonKey ?? null,
        stepId,
        attemptKey: eventData.event.attemptKey ?? readPayloadString(payload, 'attemptKey'),
        clientEventId,
        learningContext: eventData.learningContext,
      } as Prisma.InputJsonValue,
    });
  }

  return rows;
}

async function persistControlWorkbenchTaskEvidenceRows(
  rows: readonly Prisma.StudentStepResponseCreateManyInput[],
  userId: string,
  actorRole: 'student' | 'teacher' | 'admin' | 'guest',
) {
  if (actorRole !== 'student') return;

  for (const row of rows) {
    const responseData = readRecord(row.responseData);
    const evidence = readRecord(responseData.controlWorkbenchEvidence);
    const payload = readRecord(evidence.payload);
    const sourceLogId = typeof row.sourceLogId === 'string' ? row.sourceLogId : null;
    if (!sourceLogId || evidence.actorRole !== 'student') continue;

    const selectedDesignState = readRecord(payload.selectedDesignState);
    const simulationRunRefs = Array.isArray(payload.derivedResultRefs)
      ? payload.derivedResultRefs.filter((value) => {
          const ref = readRecord(value);
          return readPayloadString(ref, 'kind') === 'SimulationRun'
            && readPayloadString(ref, 'id') !== null;
        })
      : [];
    const capabilityId = typeof payload.capabilityId === 'string' ? payload.capabilityId : '';
    const verifiedRuns = [];
    for (const value of simulationRunRefs) {
      const runId = readPayloadString(readRecord(value), 'id');
      if (!runId) continue;
      const run = await prisma.simulationRun.findFirst({
        where: {
          id: runId,
          ownerUserId: userId,
          runKind: 'scene_simulation',
          sourceDomain: 'simulation_scene',
          status: 'completed',
          completedAt: { not: null },
        },
        select: {
          id: true,
          resourceId: true,
          taskSpecSnapshot: true,
          controllerSnapshotRef: true,
          summary: true,
          modelVersion: true,
          completedAt: true,
        },
      });
      if (run?.completedAt) verifiedRuns.push(run);
    }
    const resultRun = verifiedRuns[0];
    const completedAt = resultRun?.completedAt;
    if (!resultRun || !completedAt) continue;
    const taskSpec = readRecord(resultRun.taskSpecSnapshot);
    const metrics = buildSafeSimulationMetrics(resultRun.summary);
    const taskEvidence = materializeControlWorkbenchTaskEvidence({
      actor: { userId, role: 'student' },
      eventType: 'workspace_submission',
      sourceArtifactId: resultRun.id,
      occurredAt: completedAt.toISOString(),
      tier: 'submission',
      fingerprint: {
        plantRef: readPayloadString(taskSpec, 'plantRef')
          ?? readPayloadString(taskSpec, 'sceneId')
          ?? resultRun.resourceId
          ?? undefined,
        modelRef: resultRun.modelVersion,
        controllerConfigHash: resultRun.controllerSnapshotRef
          ? hashSemanticFingerprintValue(resultRun.controllerSnapshotRef)
          : undefined,
        keyInputHash: hashSemanticFingerprintValue(taskSpec),
      },
      summary: {
        sourceRef: `SimulationRun:${resultRun.id}`,
        qualityBand: Object.keys(metrics).length > 0 ? 'full' : 'partial',
        metrics: {
          ...metrics,
          visiblePanelCount: Array.isArray(payload.visiblePanelIds) ? payload.visiblePanelIds.length : 0,
          verifiedResultCount: verifiedRuns.length,
        },
        label: 'Control workbench persisted submission',
      },
      hasPersistedDesign: Object.keys(selectedDesignState).length > 0
        && verifiedRuns.length > 0,
      capabilityMappingTags: capabilityId ? [capabilityId] : [],
    });
    await persistAcceptedSimulationTaskEvidence(prisma, taskEvidence, {
      userId,
      sourceLogId,
      sessionId: row.sessionId,
      lessonId: row.lessonKey ?? null,
    });
  }
}

const SAFE_SIMULATION_METRIC_KEYS = new Set([
  'duration',
  'overshoot',
  'riseTime',
  'sampleCount',
  'score',
  'settlingTime',
  'stable',
  'steadyStateError',
  'valid',
]);

function buildSafeSimulationMetrics(summary: unknown): Record<string, number | boolean> {
  const summaryRecord = readRecord(summary);
  const metricsRecord = readRecord(summaryRecord.metrics);
  return Object.fromEntries(
    Object.entries({ ...summaryRecord, ...metricsRecord })
      .flatMap(([key, value]): Array<[string, number | boolean]> => {
        if (!SAFE_SIMULATION_METRIC_KEYS.has(key)) return [];
        if (typeof value === 'number' && Number.isFinite(value)) return [[key, value]];
        if (typeof value === 'boolean') return [[key, value]];
        return [];
      }),
  );
}

async function persistVirtualSimulationTaskEvidenceEvents(
  events: readonly NormalizedInteractionEvent[],
  userId: string,
  actorRole: 'student' | 'teacher' | 'admin' | 'guest',
  serverRecordedAt: Date,
) {
  if (actorRole !== 'student') return;

  for (const eventData of events) {
    const payload = readRecord(eventData.event.data);
    const eventType = resolveCanonicalEventType(eventData.event.type, payload);
    if (eventType !== 'simulation_finish' && eventType !== 'simulation_session_complete') continue;
    const sourceLogId = readPayloadString(payload, 'sourceLogId');
    if (!sourceLogId || eventData.event.actorRole !== 'student') continue;

    const simulationRunId = readPayloadString(payload, 'simulationRunId');
    if (!simulationRunId) continue;
    const run = await prisma.simulationRun.findFirst({
      where: {
        id: simulationRunId,
        ownerUserId: userId,
        runKind: 'scene_simulation',
        sourceDomain: 'simulation_scene',
        status: 'completed',
        completedAt: { not: null },
      },
      select: {
        id: true,
        resourceId: true,
        taskSpecSnapshot: true,
        controllerSnapshotRef: true,
        summary: true,
        modelVersion: true,
        completedAt: true,
      },
    });
    if (!run?.completedAt) continue;

    const taskSpec = readRecord(run.taskSpecSnapshot);
    const runTaskId = run.resourceId
      ?? readPayloadString(taskSpec, 'resourceId')
      ?? readPayloadString(taskSpec, 'sceneId');
    const declaredTaskId = readPayloadString(payload, 'registryId')
      ?? eventData.event.resourceKey
      ?? null;
    if (runTaskId && declaredTaskId && runTaskId !== declaredTaskId) continue;
    const metrics = buildSafeSimulationMetrics(run.summary);
    const taskEvidence = materializeVirtualSimulationTaskEvidence({
      actor: { userId, role: 'student' },
      eventType,
      namedTaskId: runTaskId ?? declaredTaskId,
      sourceArtifactId: run.id,
      occurredAt: run.completedAt.toISOString(),
      tier: 'run',
      fingerprint: {
        plantRef: readPayloadString(taskSpec, 'plantRef')
          ?? readPayloadString(taskSpec, 'sceneId')
          ?? runTaskId
          ?? undefined,
        modelRef: run.modelVersion,
        controllerConfigHash: run.controllerSnapshotRef
          ? hashSemanticFingerprintValue(run.controllerSnapshotRef)
          : undefined,
        keyInputHash: hashSemanticFingerprintValue(taskSpec),
      },
      summary: {
        sourceRef: `SimulationRun:${run.id}`,
        qualityBand: Object.keys(metrics).length > 0 ? 'full' : 'partial',
        metrics,
        label: 'Virtual simulation completed run',
      },
    });
    await persistAcceptedSimulationTaskEvidence(prisma, taskEvidence, {
      userId,
      sourceLogId,
      sessionId: eventData.sessionId,
      lessonId: eventData.event.lessonKey ?? null,
    });
  }
}

async function loadSessionEndMetadata(
  events: Array<{ event: ClassroomInteractionEventInput; resourceId: string | null }>,
) {
  const sessionIds = Array.from(
    new Set(
      events
        .map(({ event }) => event.sessionId)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    ),
  );

  if (sessionIds.length === 0) {
    return new Map();
  }

  const sessions = await prisma.classSession.findMany({
    where: { id: { in: sessionIds } },
    select: {
      id: true,
      status: true,
      endTime: true,
      classId: true,
      teacherId: true,
    },
  });

  return new Map(
    sessions.map((item) => [
      item.id,
      {
        status: item.status,
        endTime: item.endTime,
        classId: item.classId,
        teacherId: item.teacherId,
      },
    ]),
  );
}

/**
 * POST /api/interactive/events
 *
 * 批量记录互动事件
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 限流检查：防止事件上报过载
    const clientId = session.user.id;
    const limitCheck = eventRateLimiter.check(clientId);

    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: limitCheck.retryAfter },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { events } = body;
    const serverActorRole = normalizeActorRole(session.user.role);

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'Events array is required' }, { status: 400 });
    }

    // 验证并过滤事件
    const validEvents: Array<{ event: ClassroomInteractionEventInput; resourceId: string | null }> = [];
    const degradedEvents: Array<{ event: ClassroomInteractionEventInput; reason: string }> = [];

    for (const event of events as ClassroomInteractionEventInput[]) {
      const resolvedResourceKey = event.resourceKey ?? event.resourceId;
      const normalizedEvent = applyServerActorRole({
        ...event,
        resourceKey: event.resourceKey || event.resourceId || '',
      }, serverActorRole);

      // 基础校验
      if (!normalizedEvent.type || typeof normalizedEvent.timestamp !== 'number') {
        degradedEvents.push({ event: normalizedEvent, reason: 'missing_type_or_timestamp' });
        continue;
      }

      if (!resolvedResourceKey && !normalizedEvent.resourceId) {
        degradedEvents.push({ event: normalizedEvent, reason: 'missing_resource_key_and_id' });
        continue;
      }

      // 校验resourceId - 不合法的ID会导致外键错误
      const validatedResourceId = validateResourceId(normalizedEvent.resourceId);

      if (normalizedEvent.resourceId && !validatedResourceId) {
        // resourceId存在但不合法 - 降级处理，只记录到控制台
        logDegradedEvent(session.user.id, normalizedEvent, 'invalid_resource_id_format');
        // 如果resourceKey存在，仍尝试记录（resourceKey是字符串，不会触发外键错误）
        if (normalizedEvent.resourceKey) {
          validEvents.push({ event: normalizedEvent, resourceId: null });
        } else {
          degradedEvents.push({ event: normalizedEvent, reason: 'invalid_resource_id_no_fallback' });
        }
        continue;
      }

      validEvents.push({ event: normalizedEvent, resourceId: validatedResourceId });
    }

    // 记录降级事件（不入库，避免外键错误）
    for (const { event, reason } of degradedEvents) {
      logDegradedEvent(session.user.id, event, reason);
    }

    const sessionEndById = await loadSessionEndMetadata(validEvents);
    const enrichedValidEvents = normalizeInteractionContexts(validEvents, sessionEndById, {
      id: session.user.id,
      role: session.user.role,
      profile: session.user.profile ?? null,
    });
    const clientEventIds = Array.from(
      new Set(
        enrichedValidEvents
          .map((item) => item.clientEventId)
          .filter((value): value is string => typeof value === 'string' && value.length > 0),
      ),
    );
    const existingLogs = clientEventIds.length > 0
      ? await prisma.interactionLog.findMany({
        where: {
          userId: session.user.id,
          clientEventId: { in: clientEventIds },
        },
        select: {
          id: true,
          clientEventId: true,
        },
      })
      : [];
    const persistedClientEventIds = new Set(
      existingLogs
        .map((log) => log.clientEventId)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    );
    const seenClientEventIds = new Set<string>();
    let duplicateEvents = 0;
    const dedupedEvents = enrichedValidEvents.filter((item) => {
      if (!item.clientEventId) {
        return true;
      }
      if (persistedClientEventIds.has(item.clientEventId) || seenClientEventIds.has(item.clientEventId)) {
        duplicateEvents += 1;
        return false;
      }
      seenClientEventIds.add(item.clientEventId);
      return true;
    });

    const {
      events: evidenceDedupedEvents,
      duplicateSubmissionEvents,
    } = await dedupeClassroomSubmissionEvents(dedupedEvents, session.user.id);
    const trustedEvidenceEvents = evidenceDedupedEvents.map((item) => {
      const payload = item.event.data && typeof item.event.data === 'object' ? item.event.data : {};
      const canonicalEventType = resolveCanonicalEventType(item.event.type, payload);
      const trustedPayload = trustNestedEvidenceActorRoles(
        withSubmissionEvidenceQuality(payload, canonicalEventType),
        item.event.actorRole ?? serverActorRole,
      );
      return {
        ...item,
        event: {
          ...item.event,
          data: trustedPayload,
        },
      };
    });

    // Persist valid events before materializing facts so governance facts can
    // retain a direct InteractionLog sourceLogId.
    const interactionLogEvents = trustedEvidenceEvents.map((item) => {
      const { sourceLogId: _untrustedSourceLogId, ...eventData } = item.event.data ?? {};
      return {
        userId: session.user.id,
        resourceId: item.resourceId,
        resourceKey: item.event.resourceKey,
        sessionId: item.sessionId,
        lessonKey: item.event.lessonKey ?? null,
        stepId: item.event.stepId ?? null,
        actorRole: item.event.actorRole ?? null,
        attemptKey: item.event.attemptKey ?? null,
        eventType: item.event.type,
        clientEventId: item.clientEventId,
        learningContext: item.learningContext,
        invalidContextReason: item.invalidContextReason,
        eventData,
        clientEventAt: toDateTime(item.event.clientEventAt ?? item.event.timestamp),
      };
    });

    const persistedLogs = interactionLogEvents.length > 0
      ? await prisma.interactionLog.createManyAndReturn({
        data: interactionLogEvents.map((event) => ({
          userId: event.userId,
          resourceId: event.resourceId,
          resourceKey: event.resourceKey,
          sessionId: event.sessionId,
          lessonKey: event.lessonKey,
          stepId: event.stepId,
          actorRole: event.actorRole,
          attemptKey: event.attemptKey,
          eventType: event.eventType,
          clientEventId: event.clientEventId,
          learningContext: event.learningContext,
          invalidContextReason: event.invalidContextReason,
          eventData: event.eventData as Prisma.InputJsonValue,
          clientEventAt: event.clientEventAt,
        })),
        skipDuplicates: true,
        select: {
          id: true,
          clientEventId: true,
          eventData: true,
        },
      })
      : [];

    const sourceLinkedEvents = attachSourceLogIds(
      trustedEvidenceEvents,
      persistedLogs.map((log) => ({
        id: log.id,
        clientEventId: log.clientEventId ?? readJsonString(log.eventData, 'clientEventId'),
      })),
    );
    const retrySourceLinkedEvents = attachSourceLogIds(
      enrichedValidEvents.filter((item) =>
        Boolean(item.clientEventId && persistedClientEventIds.has(item.clientEventId))
      ),
      existingLogs
        .filter((log): log is typeof log & { id: string } => typeof log.id === 'string')
        .map((log) => ({
          id: log.id,
          clientEventId: log.clientEventId,
        })),
    );
    const taskMaterializationEvents = [
      ...sourceLinkedEvents,
      ...retrySourceLinkedEvents,
    ];

    const serverRecordedAt = new Date();
    await persistVirtualSimulationTaskEvidenceEvents(
      taskMaterializationEvents,
      session.user.id,
      serverActorRole,
      serverRecordedAt,
    );
    const studentStepResponseRows = buildStudentStepResponseRows(
      taskMaterializationEvents,
      session.user.id,
      serverRecordedAt,
    );
    if (studentStepResponseRows.length > 0) {
      let stepResponsesPersisted = false;
      try {
        await prisma.studentStepResponse.createMany({
          data: studentStepResponseRows,
          skipDuplicates: true,
        });
        stepResponsesPersisted = true;
      } catch (error) {
        console.error('[Interactive Events API] Failed to persist immutable student step responses:', error);
      }
      if (stepResponsesPersisted) {
        await persistControlWorkbenchTaskEvidenceRows(
          studentStepResponseRows,
          session.user.id,
          serverActorRole,
        );
      }
    }

    // Route events based on priority
    const routingResults: Array<{
      eventType: string;
      destination: 'postgresql' | 'redis' | 'dropped';
      reason?: string;
      factsCreated: number;
      factActionType: string;
    }> = [];
    const sessionsNeedingReportRefresh = new Set<string>();

    for (const eventData of sourceLinkedEvents) {
      const payload =
        eventData.event.data && typeof eventData.event.data === 'object'
          ? eventData.event.data
          : {};
      const canonicalEventType = resolveCanonicalEventType(eventData.event.type, payload);
      const learningEvent = toLearningEvent(
        {
          ...eventData.event,
          eventId: typeof eventData.event.id === 'string' ? eventData.event.id : undefined,
          actionType: canonicalEventType,
          payload: {
            ...payload,
            ...(resolveClientEventId(eventData.event) ? { clientEventId: resolveClientEventId(eventData.event) } : {}),
            learningContext: eventData.learningContext,
            ...(eventData.invalidContextReason ? { invalidContextReason: eventData.invalidContextReason } : {}),
            originalEventType: eventData.event.type,
          },
          priority: isCoreEvent(canonicalEventType) ? 'core' : 'secondary',
        },
        {
          userId: session.user.id,
          role: (session.user.role?.toLowerCase() as 'student' | 'teacher' | 'admin') || 'student',
          pagePath: resolvePagePath(payload),
          pageType: resolvePageType(payload),
        }
      );

      const result = await routeEvent(learningEvent);
      const factResult = await persistCoreLearningFact(prisma, learningEvent);
      routingResults.push({
        eventType: learningEvent.actionType,
        ...result,
        factsCreated: factResult.created,
        factActionType: factResult.actionType,
      });

      if (learningEvent.actionType === 'session_finalize' && learningEvent.sessionId) {
        sessionsNeedingReportRefresh.add(learningEvent.sessionId);
      }

      // Core facts now keep the persisted InteractionLog id through sourceLogId.
    }

    for (const sessionId of Array.from(sessionsNeedingReportRefresh)) {
      try {
        await Promise.all([
          generateSessionSummaryReports(prisma, sessionId),
          enqueueSessionSummaryReportRefresh(sessionId),
        ]);
      } catch (error) {
        console.error('[Interactive Events API] Failed to refresh session report:', error);
      }
    }

    // Update response
    return NextResponse.json({
      success: true,
      count: evidenceDedupedEvents.length,
      degraded: degradedEvents.length,
      duplicates: duplicateEvents + duplicateSubmissionEvents,
      submissionDuplicates: duplicateSubmissionEvents,
      routing: routingResults.reduce((acc, r) => {
        acc[r.destination] = (acc[r.destination] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      pending: 0,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[Interactive Events API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/interactive/events
 *
 * 查询资源的互动事件（教师端）
 *
 * Query params:
   * - resourceId: 资源 ID（可选）
   * - resourceKey: 资源逻辑标识（可选，推荐）
 * - sessionId: 课堂会话 ID（可选）
 * - userId: 用户 ID（可选）
 * - eventType: 事件类型（可选）
 * - limit: 返回数量（默认 100）
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 只有教师和管理员可以查询所有用户的事件
    const isTeacherOrAdmin = session.user.role === 'TEACHER' || session.user.role === 'ADMIN';

    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get('resourceId');
    const resourceKey = searchParams.get('resourceKey');
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');
    const eventType = searchParams.get('eventType');
    const diagnostics = searchParams.get('diagnostics');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    if (diagnostics === 'control-workbench') {
      if (!isTeacherOrAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const responses = await prisma.studentStepResponse.findMany({
        where: {
          ...(sessionId ? { sessionId } : {}),
          ...(resourceKey ? { lessonKey: resourceKey } : {}),
          ...(userId ? { userId } : {}),
        },
        orderBy: { submittedAt: 'desc' },
        take: limit,
        select: {
          userId: true,
          responseData: true,
        },
      });
      return NextResponse.json({
        diagnostics: buildControlWorkbenchTeacherDiagnostics(
          responses
            .map((response) => controlWorkbenchDiagnosticEventFromResponse(response.userId, response.responseData))
            .filter((event): event is ControlWorkbenchDiagnosticEvent => Boolean(event)),
        ),
      });
    }

    if (diagnostics === 'annotated-media') {
      if (!isTeacherOrAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const responses = await prisma.studentStepResponse.findMany({
        where: {
          ...(sessionId ? { sessionId } : {}),
          ...(resourceKey ? { lessonKey: resourceKey } : {}),
          ...(userId ? { userId } : {}),
        },
        orderBy: { submittedAt: 'desc' },
        take: limit,
        select: {
          userId: true,
          responseData: true,
        },
      });
      return NextResponse.json({
        diagnostics: buildAnnotatedMediaTeacherDiagnostics(
          responses
            .map((response) => annotatedMediaDiagnosticEventFromResponse(response.userId, response.responseData))
            .filter((event): event is AnnotatedMediaDiagnosticEvent => Boolean(event)),
        ),
      });
    }

    if (!resourceId && !resourceKey) {
      return NextResponse.json({ error: 'resourceId or resourceKey is required' }, { status: 400 });
    }

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (resourceId) {
      where.resourceId = resourceId;
    }

    if (resourceKey) {
      where.resourceKey = resourceKey;
    }

    if (sessionId) {
      where.sessionId = sessionId;
    }

    if (eventType) {
      where.eventType = eventType;
    }

    // 非教师/管理员只能查看自己的事件
    if (!isTeacherOrAdmin) {
      where.userId = session.user.id;
    } else if (userId) {
      where.userId = userId;
    }

    // 查询事件
    const events = await prisma.interactionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // 聚合统计
    const stats = await prisma.interactionLog.groupBy({
      by: ['eventType'],
      where,
      _count: { id: true },
    });

    const statsMap = Object.fromEntries(
      stats.map((s) => [s.eventType, s._count.id])
    );

    return NextResponse.json({
      events,
      stats: {
        total: events.length,
        byType: statsMap,
      },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[Interactive Events API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function controlWorkbenchDiagnosticEventFromResponse(
  userId: string,
  responseData: unknown,
): ControlWorkbenchDiagnosticEvent | null {
  const data = readRecord(responseData);
  const evidence = readRecord(data.controlWorkbenchEvidence);
  const payload = readRecord(evidence.payload);
  if (!evidence.eventType || !payload.capabilityId) return null;
  const parameterSnapshot = readRecord(payload.parameterSnapshot);
  const answerPayload = readRecord(payload.answerPayload);
  const selectedDesignState = readRecord(payload.selectedDesignState);
  const releaseState = readPayloadString(payload, 'releaseState');
  const fallbackState = readPayloadString(payload, 'fallbackState');
  if (
    releaseState !== 'unreleased'
    && releaseState !== 'released'
    && releaseState !== 'revealed'
  ) {
    return null;
  }
  if (
    fallbackState !== 'supported'
    && fallbackState !== 'fallback'
    && fallbackState !== 'unsupported'
  ) {
    return null;
  }
  return {
    actorId: userId,
    actorRole: 'student',
    lessonKey: readPayloadString(evidence, 'lessonKey') ?? '',
    stepId: readPayloadString(evidence, 'stepId') ?? '',
    moduleId: readPayloadString(evidence, 'moduleId') ?? '',
    viewed: true,
    submitted: true,
    releaseState,
    fallbackState,
    touchedParameterIds: Object.keys(parameterSnapshot),
    judgmentOutcome: readPayloadString(answerPayload, 'judgment')
      ?? readPayloadString(answerPayload, 'responseContractId')
      ?? readPayloadString(selectedDesignState, 'judgment')
      ?? null,
    attemptKey: readPayloadString(evidence, 'attemptKey') ?? '',
    clientEventId: readPayloadString(evidence, 'clientEventId') ?? '',
    clientEventAt: readPayloadString(evidence, 'clientEventAt') ?? undefined,
    serverRecordedAt: readPayloadString(payload, 'serverRecordedAt') ?? undefined,
  };
}

function annotatedMediaDiagnosticEventFromResponse(
  userId: string,
  responseData: unknown,
): AnnotatedMediaDiagnosticEvent | null {
  const data = readRecord(responseData);
  return annotatedMediaDiagnosticEventFromEvidence(userId, data.annotatedMediaEvidence);
}
