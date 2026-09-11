import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readGovernedCourseStudentDemoStep } from '@/features/personalization/path-planning/adaptive-path-destination-contract';
import { prisma } from '@/lib/prisma';
import { eventRateLimiter } from '@/lib/rate-limiter';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import type { ClassroomInteractionEventInput } from '@/lib/classroom-analytics/types';
import { toLearningEvent } from '@/lib/data-governance/event-protocol';
import {
  LearningRecordContractError,
  MIGRATED_INTERACTIVE_PRODUCER_ACTION,
  acceptLearningRecordEvent,
  createMemoryAcceptanceStore,
} from '@/features/learning-record/event-contract';
import { routeEvent } from '@/lib/data-governance/event-buffer';
import { isCoreEvent } from '@/lib/data-governance/event-types';
import { resolveCanonicalEventType } from '@/lib/data-governance/event-normalization';
import { shouldMaterializeLearningFact } from '@/lib/data-governance/learning-fact-materialization';
import { currentCaptureRevision, ingestLearningFact } from '@/features/learning-record/ingestion/public-api';
import { INGESTION_STATUS } from '@/features/learning-record/ingestion/types';
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
  evaluatePersistedSimulationRunQuality,
  materializeControlWorkbenchTaskEvidence,
  materializeVirtualSimulationTaskEvidence,
} from '@/lib/data-governance/simulation-task-materialization';
import { persistAcceptedSimulationTaskEvidence } from '@/lib/data-governance/simulation-task-learning-fact';
import { requestRealtimeSimulationTaskReconciliation } from '@/lib/data-governance/simulation-task-reconciliation';
import {
  hashSemanticFingerprintValue,
  hashSimulationTaskSpecKeyInputs,
} from '@/lib/data-governance/simulation-task-evidence';
import {
  persistedControlWorkbenchRunMatchesContext,
  resolveTrustedControlWorkbenchContext,
} from '@/lib/data-governance/control-workbench-run-context';
import {
  buildCanonicalSubmissionIdentity,
  acceptClassroomSubmissionEvidence,
  type ClassroomSubmissionEvidenceReceipt,
  type ClassifiedSubmissionWriteInput,
} from '@/features/classroom/session/submission-evidence';
import { createPrismaSubmissionEvidenceRuntime } from '@/features/classroom/session/adapters/submission-evidence-commands';
import { materializePersistedEvidenceById } from '@/lib/data-governance/session-fact-replay';

export const dynamic = 'force-dynamic';

// 共享提交证据写入器：分类提交经会话级事务边界写入（锁/幂等/单调序列/晚到分类）
const submissionEvidenceRuntime = createPrismaSubmissionEvidenceRuntime();

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
function isAuthoritativePathSubmission(eventData: Record<string, unknown>): boolean {
  const answers = readRecord(eventData.answers);
  const digest = readRecord(eventData.answerDigest);
  const hasAnswers = Object.keys(answers).length > 0 || Object.keys(digest).length > 0;
  const summaries = Array.isArray(eventData.questionSummaries) ? eventData.questionSummaries : [];
  const schemaVersion = typeof eventData.schemaVersion === 'string' ? eventData.schemaVersion : '';
  const score = typeof eventData.score === 'number' && Number.isFinite(eventData.score);
  if (schemaVersion === 'manifest-submission-v2' && (hasAnswers || summaries.length > 0)) {
    return true;
  }
  return score && (hasAnswers || summaries.length > 0);
}

function claimedPathLaunchFields(eventData: Record<string, unknown>): boolean {
  const pathId = typeof eventData.pathId === 'string' ? eventData.pathId.trim() : '';
  const nodeId = typeof eventData.nodeId === 'string' ? eventData.nodeId.trim() : '';
  return Boolean(pathId && nodeId);
}

async function bindOwnedPathLaunchEvent(
  userId: string,
  eventData: Record<string, unknown>,
  resourceId: string | null,
): Promise<{
  eventData: Record<string, unknown>;
  resourceId: string | null;
  outcome: 'unclaimed' | 'forged' | 'unbound' | 'bound';
}> {
  const {
    pathExecutionBound: _forgedBound,
    pathId: claimedPathId,
    nodeId: claimedNodeId,
    ...rest
  } = eventData;
  const pathId = typeof claimedPathId === 'string' ? claimedPathId.trim() : '';
  const nodeId = typeof claimedNodeId === 'string' ? claimedNodeId.trim() : '';
  if (!pathId || !nodeId) {
    return { eventData: rest, resourceId, outcome: 'unclaimed' };
  }
  const path = await prisma.learningPath.findFirst({
    where: { id: pathId, userId },
    select: { id: true, goalId: true, nodeIds: true, pathPayload: true },
  });
  if (!path) {
    return { eventData: rest, resourceId, outcome: 'forged' };
  }
  const nodeIds = Array.isArray(path.nodeIds)
    ? path.nodeIds.filter((value): value is string => typeof value === 'string')
    : [];
  const payload = path.pathPayload && typeof path.pathPayload === 'object' && !Array.isArray(path.pathPayload)
    ? path.pathPayload as Record<string, unknown>
    : {};
  const planNodes = Array.isArray(payload.planNodes) ? payload.planNodes : [];
  const node = planNodes.find((entry) => (
    entry
    && typeof entry === 'object'
    && !Array.isArray(entry)
    && (entry as { nodeId?: unknown }).nodeId === nodeId
  )) as Record<string, unknown> | undefined;
  if ((nodeIds.length > 0 && !nodeIds.includes(nodeId)) || !node) {
    return { eventData: rest, resourceId, outcome: 'forged' };
  }
  const teachingResourceIds = [...new Set([
    node.sourceKind === 'teaching_resource' && typeof node.sourceRef === 'string' ? node.sourceRef : null,
    nodeId.startsWith('teaching-resource:') ? nodeId.slice('teaching-resource:'.length) : null,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim()))];
  const registryCandidates = [...new Set([
    node.registryId,
    node.sourceKind === 'teaching_resource' ? null : node.sourceRef,
    nodeId.startsWith('registry:') ? nodeId.slice('registry:'.length) : null,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim()))];
  const owned = (teachingResourceIds.length > 0 || registryCandidates.length > 0)
    ? await prisma.teachingResource.findFirst({
      where: {
        OR: [
          ...(teachingResourceIds.length > 0 ? [{ id: { in: teachingResourceIds } }] : []),
          ...(registryCandidates.length > 0 ? [{ registryId: { in: registryCandidates } }] : []),
        ],
      },
      select: { id: true },
    })
    : null;
  const courseDemoStep = String(node.type) === 'simulation'
    ? readGovernedCourseStudentDemoStep(String(node.target ?? ''))
    : null;
  if (!owned && !courseDemoStep) {
    return { eventData: rest, resourceId, outcome: 'unbound' };
  }
  const claimedStep = typeof rest.stepId === 'string' ? rest.stepId.trim() : '';
  if (courseDemoStep && claimedStep && claimedStep !== courseDemoStep) {
    return { eventData: rest, resourceId, outcome: 'unbound' };
  }
  if (!isAuthoritativePathSubmission(rest)) {
    return { eventData: rest, resourceId, outcome: 'unbound' };
  }
  return {
    resourceId: owned?.id ?? resourceId,
    outcome: 'bound',
    eventData: {
      ...rest,
      pathId: path.id,
      nodeId,
      ...(courseDemoStep ? { stepId: courseDemoStep } : {}),
      ...(typeof path.goalId === 'string' && path.goalId ? { goalId: path.goalId } : {}),
      pathExecutionBound: true,
    },
  };
}

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

function resolveCanonicalSubmissionCardId(payload: Record<string, unknown>): string {
  return readPayloadString(payload, 'cardId')
    ?? readPayloadString(payload, 'questionId')
    ?? readFirstQuestionCardId(payload)
    ?? 'step';
}

function resolveClassifiedSubmissionStepId(item: NormalizedInteractionEvent): string | null {
  return item.event.stepId ?? readPayloadString(readRecord(item.event.data), 'stepId');
}

function isClassifiedSubmissionEvent(item: NormalizedInteractionEvent, userId: string): boolean {
  const payload = readRecord(item.event.data);
  const canonicalEventType = resolveCanonicalEventType(item.event.type, payload);
  const isSubmission = canonicalEventType === 'lesson_submit' || canonicalEventType === 'lesson_resubmit';
  const stepId = resolveClassifiedSubmissionStepId(item);
  return Boolean(
    isSubmission
    && item.sessionId
    && stepId
    && buildCanonicalSubmissionIdentity({
      userId,
      sessionId: item.sessionId,
      lessonKey: item.event.lessonKey ?? null,
      stepId,
      cardId: resolveCanonicalSubmissionCardId(payload),
      attemptKey: item.event.attemptKey ?? readPayloadString(payload, 'attemptKey'),
      clientEventId: resolveClientEventId(item.event),
    }),
  );
}

/**
 * 分类提交（lesson_submit/lesson_resubmit）与被动事件的分区：
 * 分类提交走共享写入器（会话锁 + 幂等 + 单调序列 + 晚到复盘分类）；
 * 无法建立规范身份的提交视为契约违约事件降级（不入库），确保不存在
 * 绕过水位边界的证据写入路径。
 */
function partitionClassifiedSubmissionEvents(events: NormalizedInteractionEvent[], userId: string): {
  submissions: NormalizedInteractionEvent[];
  identityLessSubmissions: NormalizedInteractionEvent[];
  legacy: NormalizedInteractionEvent[];
} {
  const submissions: NormalizedInteractionEvent[] = [];
  const identityLessSubmissions: NormalizedInteractionEvent[] = [];
  const legacy: NormalizedInteractionEvent[] = [];
  for (const item of events) {
    const payload = readRecord(item.event.data);
    const canonicalEventType = resolveCanonicalEventType(item.event.type, payload);
    const isSubmission = canonicalEventType === 'lesson_submit' || canonicalEventType === 'lesson_resubmit';
    if (!isSubmission) {
      legacy.push(item);
    } else if (isClassifiedSubmissionEvent(item, userId)) {
      submissions.push(item);
    } else if (claimedPathLaunchFields(payload) && isAuthoritativePathSubmission(payload)) {
      legacy.push(item);
    } else {
      identityLessSubmissions.push(item);
    }
  }
  return { submissions, identityLessSubmissions, legacy };
}

function buildClassifiedSubmissionInput(
  item: NormalizedInteractionEvent,
  userId: string,
  serverRecordedAt: Date,
): ClassifiedSubmissionWriteInput | null {
  const payload = readRecord(item.event.data);
  const stepId = resolveClassifiedSubmissionStepId(item);
  const submittedAt = toDateTime(item.event.clientEventAt ?? item.event.timestamp);
  if (!item.sessionId || !stepId || !submittedAt) return null;

  const identity = buildCanonicalSubmissionIdentity({
    userId,
    sessionId: item.sessionId,
    lessonKey: item.event.lessonKey ?? null,
    stepId,
    cardId: resolveCanonicalSubmissionCardId(payload),
    attemptKey: item.event.attemptKey ?? readPayloadString(payload, 'attemptKey'),
    clientEventId: resolveClientEventId(item.event),
  });
  if (!identity) return null;

  const canonicalEventType = resolveCanonicalEventType(item.event.type, payload);
  const trustedActorRole = item.event.actorRole ?? 'student';
  // 先剥离不可信 sourceLogId 再做证据规范化，防止伪造血缘进入响应证据
  const { sourceLogId: _untrustedSourceLogId, ...trustedPayload } = payload;
  const normalizedPayload = trustNestedEvidenceActorRoles(
    withSubmissionEvidenceQuality(trustedPayload, canonicalEventType),
    trustedActorRole,
  );
  const clientEventId = resolveClientEventId(item.event);
  const attemptKey = item.event.attemptKey ?? readPayloadString(payload, 'attemptKey');
  const lessonKey = item.event.lessonKey ?? null;
  // 证据草稿在事务前只做结构物化；真实 sourceLogId 由写入器在事务内回填
  const controlWorkbenchEvidenceDraft = materializeControlWorkbenchEvidenceFromSubmissionPayload(
    normalizedPayload,
    {
      trustedSourceLogId: 'pending-submission-transaction',
      serverRecordedAt: serverRecordedAt.toISOString(),
    },
  );
  const annotatedMediaEvidenceDraft = materializeAnnotatedMediaEvidenceFromSubmissionPayload(
    normalizedPayload,
    {
      trustedSourceLogId: 'pending-submission-transaction',
      serverRecordedAt: serverRecordedAt.toISOString(),
    },
  );

  // trustedPayload 已剥离不可信 sourceLogId，可直接作为源事件载荷
  const trustedEventData = trustedPayload;

  return {
    userId,
    submissionIdentity: identity.identity,
    identityVersion: identity.identityVersion,
    sourceEvent: {
      resourceId: item.resourceId,
      resourceKey: item.event.resourceKey ?? null,
      sessionId: item.sessionId,
      lessonKey,
      stepId,
      actorRole: item.event.actorRole ?? null,
      eventType: item.event.type,
      clientEventId,
      learningContext: item.learningContext,
      invalidContextReason: item.invalidContextReason,
      eventData: trustedEventData as Prisma.InputJsonValue,
      clientEventAt: submittedAt,
    },
    response: {
      lessonKey,
      stepId,
      attemptKey,
      clientEventId,
      submittedAt,
      buildResponseData: (sourceLogId: string): Prisma.InputJsonObject => ({
        ...normalizedPayload,
        sourceLogId,
        ...(controlWorkbenchEvidenceDraft
          ? { controlWorkbenchEvidence: { ...controlWorkbenchEvidenceDraft, sourceLogId } }
          : {}),
        ...(annotatedMediaEvidenceDraft
          ? { annotatedMediaEvidence: { ...annotatedMediaEvidenceDraft, sourceLogId } }
          : {}),
        eventType: canonicalEventType,
        resourceKey: item.event.resourceKey,
        lessonKey,
        stepId,
        attemptKey,
        clientEventId,
        learningContext: item.learningContext,
      } as Prisma.InputJsonObject),
    },
  };
}

async function acceptClassifiedSubmissions(
  events: NormalizedInteractionEvent[],
  userId: string,
  serverRecordedAt: Date,
): Promise<{
  receipts: Array<{ item: NormalizedInteractionEvent; receipt: ClassroomSubmissionEvidenceReceipt }>;
  acceptedInputs: Array<{ input: ClassifiedSubmissionWriteInput; receipt: ClassroomSubmissionEvidenceReceipt }>;
  acceptedCount: number;
  postSessionReviewCount: number;
  duplicateCount: number;
}> {
  const receipts: Array<{ item: NormalizedInteractionEvent; receipt: ClassroomSubmissionEvidenceReceipt }> = [];
  const acceptedInputs: Array<{ input: ClassifiedSubmissionWriteInput; receipt: ClassroomSubmissionEvidenceReceipt }> = [];
  let acceptedCount = 0;
  let postSessionReviewCount = 0;
  let duplicateCount = 0;

  for (const item of events) {
    const input = buildClassifiedSubmissionInput(item, userId, serverRecordedAt);
    if (!input) {
      duplicateCount += 1;
      continue;
    }
    const receipt = await acceptClassroomSubmissionEvidence(submissionEvidenceRuntime, input);
    receipts.push({ item, receipt });
    if (receipt.status === 'ACCEPTED') {
      acceptedCount += 1;
      acceptedInputs.push({ input, receipt });
    } else if (receipt.status === 'POST_SESSION_REVIEW') {
      postSessionReviewCount += 1;
    } else {
      duplicateCount += 1;
      // 仅 ACCEPTED 回执重放事实物化：POST_SESSION_REVIEW 的重复回执不得
      // 把晚到复盘事实写进原闭包的报告读法；权威输入是回执 ID 对应的
      // 持久化证据行（sourceEventId 唯一约束保证不双计）
      if (receipt.evidenceStatus === 'ACCEPTED') {
        try {
          await materializePersistedEvidenceById(prisma, receipt.evidenceId);
        } catch (error) {
          console.error('[Interactive Events API] Duplicate-receipt fact replay failed (closure phase will recover):', error);
        }
      }
    }
  }

  return { receipts, acceptedInputs, acceptedCount, postSessionReviewCount, duplicateCount };
}

async function persistControlWorkbenchTaskEvidenceRows(
  rows: readonly Prisma.StudentStepResponseCreateManyInput[],
  userId: string,
  actorRole: 'student' | 'teacher' | 'admin' | 'guest',
) {
  if (actorRole !== 'student') return;
  let acceptedTaskEvidence = false;

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
    const moduleId = typeof evidence.moduleId === 'string' ? evidence.moduleId : '';
    const sessionId = typeof row.sessionId === 'string' ? row.sessionId : '';
    const lessonId = typeof row.lessonKey === 'string' ? row.lessonKey : '';
    const stepId = typeof row.stepId === 'string' ? row.stepId : '';
    if (!capabilityId || !moduleId || !sessionId || !lessonId || !stepId) continue;
    const trustedContext = await resolveTrustedControlWorkbenchContext({
      user: { id: userId, role: actorRole.toUpperCase() },
      sessionId,
      lessonId,
      stepId,
      moduleId,
      capabilityId,
      requireActive: false,
    });
    if (!trustedContext) continue;
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
          sessionId: true,
          resourceId: true,
          taskSpecSnapshot: true,
          controllerSnapshotRef: true,
          summary: true,
          modelVersion: true,
          completedAt: true,
        },
      });
      if (
        run?.completedAt
        && persistedControlWorkbenchRunMatchesContext(run, trustedContext)
      ) {
        verifiedRuns.push(run);
      }
    }
    for (const resultRun of verifiedRuns) {
      const completedAt = resultRun.completedAt;
      if (!completedAt) continue;
      const taskSpec = readRecord(resultRun.taskSpecSnapshot);
      const metrics = buildSafeSimulationMetrics(resultRun.summary);
      const quality = evaluatePersistedSimulationRunQuality(
        resultRun.taskSpecSnapshot,
        resultRun.summary,
      );
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
          keyInputHash: hashSimulationTaskSpecKeyInputs(taskSpec),
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
        hasPersistedDesign: Object.keys(selectedDesignState).length > 0,
        hasQualityTarget: quality.hasQualityTarget,
        meetsQualityTarget: quality.meetsQualityTarget,
        capabilityMappingTags: capabilityId ? [capabilityId] : [],
      });
      const persisted = await persistAcceptedSimulationTaskEvidence(prisma, taskEvidence, {
        userId,
        sourceLogId,
        sessionId: row.sessionId,
        lessonId: row.lessonKey ?? null,
      });
      if (persisted) {
        acceptedTaskEvidence = true;
      }
    }
  }
  if (acceptedTaskEvidence) {
    await requestRealtimeSimulationTaskReconciliation(prisma, {
      userId,
      reason: 'control-workbench-task-evidence',
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
  let acceptedTaskEvidence = false;

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
        sessionId: true,
        resourceId: true,
        taskSpecSnapshot: true,
        controllerSnapshotRef: true,
        summary: true,
        modelVersion: true,
        completedAt: true,
      },
    });
    if (!run?.completedAt) continue;
    if ((run.sessionId ?? null) !== (eventData.sessionId ?? null)) continue;

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
        keyInputHash: hashSimulationTaskSpecKeyInputs(taskSpec),
      },
      summary: {
        sourceRef: `SimulationRun:${run.id}`,
        qualityBand: Object.keys(metrics).length > 0 ? 'full' : 'partial',
        metrics,
        label: 'Virtual simulation completed run',
      },
    });
    const persisted = await persistAcceptedSimulationTaskEvidence(prisma, taskEvidence, {
      userId,
      sourceLogId,
      sessionId: eventData.sessionId,
      lessonId: eventData.event.lessonKey ?? null,
    });
    if (persisted) {
      acceptedTaskEvidence = true;
    }
  }
  if (acceptedTaskEvidence) {
    await requestRealtimeSimulationTaskReconciliation(prisma, {
      userId,
      reason: 'virtual-simulation-task-evidence',
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

    // 先分区：分类提交的幂等权威在写入器事务内（唯一锚点 + 回执重放），
    // 绝不被通用 clientEventId 预过滤拦截——同 clientEventId 的重试必须
    // 到达写入器以取得 DUPLICATE 回执并重放持久化证据。
    const prePartition = partitionClassifiedSubmissionEvents(enrichedValidEvents, session.user.id);
    let degradedSubmissionEvents = 0;
    for (const item of prePartition.identityLessSubmissions) {
      logDegradedEvent(session.user.id, item.event, 'submission_without_canonical_identity');
      degradedSubmissionEvents += 1;
    }

    // clientEventId 预去重只作用于被动/遗留事件（它们的写路径无事务幂等）
    const clientEventIds = Array.from(
      new Set(
        prePartition.legacy
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
    const dedupedLegacyEvents = prePartition.legacy.filter((item) => {
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

    const trustPayload = (item: NormalizedInteractionEvent) => {
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
    };
    const legacyEvidenceEvents = dedupedLegacyEvents.map(trustPayload);
    const classifiedSubmissions = prePartition.submissions.map(trustPayload);

    // Persist valid events before materializing facts so governance facts can
    // retain a direct InteractionLog sourceLogId.
    const interactionLogEvents = [];
    for (const item of legacyEvidenceEvents) {
      const { sourceLogId: _untrustedSourceLogId, ...eventData } = item.event.data ?? {};
      const bound = await bindOwnedPathLaunchEvent(session.user.id, eventData, item.resourceId);
      if (bound.outcome === 'forged') {
        logDegradedEvent(session.user.id, item.event, 'forged_path_launch_context');
        continue;
      }
      interactionLogEvents.push({
        userId: session.user.id,
        resourceId: bound.resourceId,
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
        eventData: bound.eventData,
        clientEventAt: toDateTime(item.event.clientEventAt ?? item.event.timestamp),
      });
    }

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
      legacyEvidenceEvents,
      persistedLogs.map((log) => ({
        id: log.id,
        clientEventId: log.clientEventId ?? readJsonString(log.eventData, 'clientEventId'),
      })),
    );
    const retrySourceLinkedEvents = attachSourceLogIds(
      enrichedValidEvents.filter((item) =>
        Boolean(item.clientEventId && persistedClientEventIds.has(item.clientEventId))
        // 已由写入器事务持久化的分类提交不再重复构建响应行
        && !isClassifiedSubmissionEvent(item, session.user.id)
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
    // 分类提交：会话锁内幂等写入；ACTIVE/PAUSED 分配单调序列，FINISHED 之后保留为 POST_SESSION_REVIEW
    const submissionOutcome = await acceptClassifiedSubmissions(
      classifiedSubmissions,
      session.user.id,
      serverRecordedAt,
    );
    const acceptedSubmissionMaterializationEvents = submissionOutcome.receipts
      .filter(({ receipt }) => receipt.status === 'ACCEPTED')
      .map(({ item, receipt }) => ({
        ...item,
        event: {
          ...item.event,
          data: {
            ...readRecord(item.event.data),
            sourceLogId: receipt.sourceLogId,
          } as Record<string, unknown>,
        },
      }));
    const acceptedSubmissionEvidenceRows = submissionOutcome.acceptedInputs.map(({ input, receipt }) => ({
      userId: input.userId,
      sessionId: input.sourceEvent.sessionId,
      lessonKey: input.response.lessonKey,
      stepId: input.response.stepId,
      sourceLogId: receipt.sourceLogId,
      responseData: input.response.buildResponseData(receipt.sourceLogId) as Prisma.InputJsonValue,
    }));
    await persistVirtualSimulationTaskEvidenceEvents(
      taskMaterializationEvents,
      session.user.id,
      serverActorRole,
      serverRecordedAt,
    );
    if (acceptedSubmissionEvidenceRows.length > 0) {
      await persistControlWorkbenchTaskEvidenceRows(
        acceptedSubmissionEvidenceRows as Prisma.StudentStepResponseCreateManyInput[],
        session.user.id,
        serverActorRole,
      );
    }

    // Route events based on priority
    const routingResults: Array<{
      eventType: string;
      destination: 'postgresql' | 'redis' | 'dropped';
      reason?: string;
      factsCreated: number;
      factActionType: string;
      clientEventId?: string | null;
    }> = [];
    const sessionsNeedingReportRefresh = new Set<string>();
    const learningRecordStore = createMemoryAcceptanceStore();
    let ingestDegraded = 0;

    for (const eventData of [...sourceLinkedEvents, ...acceptedSubmissionMaterializationEvents]) {
      const payload =
        eventData.event.data && typeof eventData.event.data === 'object'
          ? eventData.event.data
          : {};
      const canonicalEventType = resolveCanonicalEventType(eventData.event.type, payload);
      const clientEventId = resolveClientEventId(eventData.event);
      if (canonicalEventType === MIGRATED_INTERACTIVE_PRODUCER_ACTION && clientEventId) {
        try {
          await acceptLearningRecordEvent(learningRecordStore, {
            subjectId: session.user.id,
            role: (session.user.role?.toLowerCase() as 'student' | 'teacher' | 'admin') || 'student',
            producerAuthority: 'assessment-producer',
            receivedAt: new Date(),
            sessionId: eventData.sessionId ?? undefined,
            captureRevision: process.env.APP_REVISION || process.env.GIT_SHA || 'working-tree',
            revision: process.env.APP_REVISION || process.env.GIT_SHA || 'working-tree',
          }, {
            action: canonicalEventType,
            eventId: clientEventId,
            sourceEventId: clientEventId,
            sessionId: eventData.sessionId ?? undefined,
            payload: {
              eventType: canonicalEventType,
              learningContext: eventData.learningContext,
              stepId: typeof payload.stepId === 'string' ? payload.stepId : undefined,
            },
          });
        } catch (error) {
          if (error instanceof LearningRecordContractError) {
            routingResults.push({
              eventType: canonicalEventType,
              destination: 'dropped',
              reason: error.code,
              factsCreated: 0,
              factActionType: canonicalEventType,
              clientEventId,
            });
            continue;
          }
          throw error;
        }
      }
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

      const materializesFact = shouldMaterializeLearningFact(
        canonicalEventType,
        payload && typeof payload === 'object' ? payload : {},
      );
      if (materializesFact) {
        const ingestResult = await ingestLearningFact({
          db: prisma as never,
          transport: 'direct',
          event: learningEvent,
          actorUserId: session.user.id,
          captureRevision: currentCaptureRevision(),
          classId: learningEvent.classId,
        });
        const ingestFailed = ingestResult.status === INGESTION_STATUS.terminalFailed
          || ingestResult.status === INGESTION_STATUS.retryableFailed;
        if (ingestFailed) ingestDegraded += 1;
        routingResults.push({
          eventType: learningEvent.actionType,
          destination: ingestFailed ? 'dropped' : 'postgresql',
          reason: ingestFailed
            ? (ingestResult.failure?.code ?? ingestResult.adapter?.reason ?? ingestResult.status)
            : undefined,
          factsCreated: ingestFailed ? 0 : ingestResult.factsCreated,
          factActionType: canonicalEventType,
          clientEventId,
        });
      } else {
        const result = await routeEvent(learningEvent);
        routingResults.push({
          eventType: learningEvent.actionType,
          ...result,
          factsCreated: 0,
          factActionType: canonicalEventType,
          clientEventId,
        });
      }

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
      count: dedupedLegacyEvents.length + submissionOutcome.acceptedCount
        + submissionOutcome.postSessionReviewCount + submissionOutcome.duplicateCount,
      degraded: degradedEvents.length + degradedSubmissionEvents + ingestDegraded,
      duplicates: duplicateEvents + submissionOutcome.duplicateCount,
      submissionDuplicates: submissionOutcome.duplicateCount,
      postSessionReviewSubmissions: submissionOutcome.postSessionReviewCount,
      acceptedSubmissions: submissionOutcome.acceptedCount,
      routing: routingResults.reduce((acc, r) => {
        acc[r.destination] = (acc[r.destination] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      routingFailures: routingResults
        .filter((result) => result.destination === 'dropped')
        .map((result) => ({
          eventType: result.eventType,
          factActionType: result.factActionType,
          reason: result.reason ?? 'dropped',
          clientEventId: result.clientEventId ?? null,
        })),
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

// 学生原始 AI 提问所在事件类型（原始与 canonical 两种写法）；普通读路径整体排除
const PRIVATE_AI_QUERY_EVENT_TYPES = ['ai_query', 'ai_query_submit'];

type TeacherClassReadScope = {
  sessionIds: string[];
  studentIds: string[];
};

// 教师可读范围只来自服务器拥有的关系：Class.teacherId → ClassSession.classId / StudentProfile.classId；
// 请求中的 sessionId/userId 只是已授权范围内的过滤条件，绝不扩大范围
async function resolveAuthorizedTeacherScope(
  teacherId: string,
  sessionId: string | null,
  userId: string | null,
): Promise<TeacherClassReadScope | 'forbidden'> {
  const classes = await prisma.class.findMany({
    where: { teacherId },
    select: { id: true },
  });
  const classIds = classes.map((cls) => cls.id);
  if (classIds.length === 0) {
    if (sessionId || userId) return 'forbidden';
    return { sessionIds: [], studentIds: [] };
  }
  const [sessions, students] = await Promise.all([
    prisma.classSession.findMany({
      where: { classId: { in: classIds } },
      select: { id: true },
    }),
    prisma.studentProfile.findMany({
      where: { classId: { in: classIds } },
      select: { userId: true },
    }),
  ]);
  const scope: TeacherClassReadScope = {
    sessionIds: sessions.map((session) => session.id),
    studentIds: students.map((student) => student.userId),
  };
  if (sessionId && !scope.sessionIds.includes(sessionId)) return 'forbidden';
  if (userId && !scope.studentIds.includes(userId)) return 'forbidden';
  return scope;
}

// 普通 API 只返回 allowlist 投影；eventData 仅在服务端用于 canonical 解析，不进入响应
function toTeacherSafeEvent(log: {
  eventType: string;
  eventData: Prisma.JsonValue;
  resourceKey: string | null;
  lessonKey: string | null;
  stepId: string | null;
  attemptKey: string | null;
  clientEventAt: Date | null;
  createdAt: Date;
}): {
  eventType: string;
  resourceKey: string | null;
  lessonKey: string | null;
  stepId: string | null;
  attemptKey: string | null;
  clientEventAt: string | null;
  createdAt: string;
} {
  return {
    eventType: resolveCanonicalEventType(log.eventType, readRecord(log.eventData)),
    resourceKey: log.resourceKey,
    lessonKey: log.lessonKey,
    stepId: log.stepId,
    attemptKey: log.attemptKey,
    clientEventAt: log.clientEventAt ? log.clientEventAt.toISOString() : null,
    createdAt: log.createdAt.toISOString(),
  };
}

/**
 * GET /api/interactive/events
 *
 * 查询资源的互动事件（教师端；普通响应只返回教师安全投影）
 *
 * Query params:
   * - resourceId: 资源 ID（可选）
   * - resourceKey: 资源逻辑标识（可选，推荐）
 * - sessionId: 课堂会话 ID（可选，须属于教师拥有的班级）
 * - userId: 用户 ID（可选，须属于教师班级名册）
 * - eventType: 事件类型（可选）
 * - diagnostics: control-workbench | annotated-media（教师/管理员）
 * - limit: 返回数量（默认 100）
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isTeacher = session.user.role === 'TEACHER';
    const isTeacherOrAdmin = isTeacher || session.user.role === 'ADMIN';

    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get('resourceId');
    const resourceKey = searchParams.get('resourceKey');
    const sessionId = searchParams.get('sessionId');
    const userId = searchParams.get('userId');
    const eventType = searchParams.get('eventType');
    const diagnostics = searchParams.get('diagnostics');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // 教师可读范围先于任何事件/响应表读取解析；显式越权目标直接拒绝
    const teacherScope = isTeacher
      ? await resolveAuthorizedTeacherScope(session.user.id, sessionId, userId)
      : null;
    if (teacherScope === 'forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (diagnostics === 'control-workbench' || diagnostics === 'annotated-media') {
      if (!isTeacherOrAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      // 诊断分支与普通读共用同一服务器派生范围；教师无 session 锚定时只看班级绑定会话，
      // 且始终叠加班级名册约束（转班学生的历史会话数据不再对旧班教师可见）
      const scopeWhere = teacherScope
        ? {
            ...(sessionId ? { sessionId } : { sessionId: { in: teacherScope.sessionIds } }),
            userId: userId ?? { in: teacherScope.studentIds },
          }
        : {
            ...(sessionId ? { sessionId } : {}),
            ...(userId ? { userId } : {}),
          };
      const responses = await prisma.studentStepResponse.findMany({
        where: {
          ...scopeWhere,
          ...(resourceKey ? { lessonKey: resourceKey } : {}),
        },
        orderBy: { submittedAt: 'desc' },
        take: limit,
        select: {
          userId: true,
          responseData: true,
        },
      });
      return NextResponse.json({
        diagnostics: diagnostics === 'control-workbench'
          ? buildControlWorkbenchTeacherDiagnostics(
            responses
              .map((response) => controlWorkbenchDiagnosticEventFromResponse(response.userId, response.responseData))
              .filter((event): event is ControlWorkbenchDiagnosticEvent => Boolean(event)),
          )
          : buildAnnotatedMediaTeacherDiagnostics(
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

    if (eventType) {
      // 显式查询私有 AI 提问类型直接空结果，保持与投影和聚合同口径
      where.eventType = PRIVATE_AI_QUERY_EVENT_TYPES.includes(eventType)
        ? { in: [] }
        : eventType;
    } else {
      // 学生原始 AI 提问不进入普通教师查询（含聚合统计）
      where.eventType = { notIn: PRIVATE_AI_QUERY_EVENT_TYPES };
    }

    // 非教师/管理员只能查看自己的事件；教师读取范围由服务器派生的班级会话与名册限定
    if (!isTeacherOrAdmin) {
      where.userId = session.user.id;
      if (sessionId) {
        where.sessionId = sessionId;
      }
    } else if (teacherScope) {
      where.sessionId = sessionId ?? { in: teacherScope.sessionIds };
      where.userId = userId ?? { in: teacherScope.studentIds };
    } else {
      if (sessionId) {
        where.sessionId = sessionId;
      }
      if (userId) {
        where.userId = userId;
      }
    }

    // 查询事件（select 只取投影所需字段；eventData 仅用于服务端 canonical 解析）
    const events = await prisma.interactionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        eventType: true,
        eventData: true,
        resourceKey: true,
        lessonKey: true,
        stepId: true,
        attemptKey: true,
        clientEventAt: true,
        createdAt: true,
      },
    });

    // 兜底：载荷声明的私有 AI 提问事件即使以其他原始类型落库也不进入投影
    const projectedEvents = events
      .filter((log) => resolveCanonicalEventType(log.eventType, readRecord(log.eventData)) !== 'ai_query_submit')
      .map(toTeacherSafeEvent);

    // 聚合统计与投影列表同口径（canonical 类型、页内归集），私有 AI 活动不进入任何统计
    const statsMap = projectedEvents.reduce<Record<string, number>>((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      events: projectedEvents,
      stats: {
        total: projectedEvents.length,
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
