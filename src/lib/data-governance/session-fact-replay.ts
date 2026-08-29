import {
  currentCaptureRevision,
  ingestLearningFact,
  INGESTION_STATUS,
} from '@/features/learning-record/ingestion/public-api';
import type { IngestionWriteDb } from '@/features/learning-record/ingestion/types';
import { toLearningEvent } from './event-protocol';
import type { ClosureEvidenceRow } from './session-closure-phases';

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

type ReplayDb = {
  learningFact: unknown;
  studentStepResponse: { findUnique: Function };
};

/**
 * 按回执 ID 从数据库读取持久化证据并重放物化。
 * DUPLICATE 回执的自愈入口：重放的权威输入是已持久化的 StudentStepResponse
 * 行（与规范身份解耦的答案内容也以持久化行为准），绝不是重试请求的载荷。
 */
export async function materializePersistedEvidenceById(
  db: ReplayDb,
  evidenceId: string,
): Promise<boolean> {
  const row = await db.studentStepResponse.findUnique({
    where: { id: evidenceId },
    select: {
      userId: true,
      sessionId: true,
      clientEventId: true,
      sourceLogId: true,
      submittedAt: true,
      responseData: true,
      evidenceStatus: true,
    },
  });
  // 晚到复盘证据永不重放为事实（默认报告按会话读事实，会污染原闭包）
  if (!row || !row.clientEventId || row.evidenceStatus !== 'ACCEPTED') return false;
  return materializeEvidenceRow(db, {
    userId: row.userId,
    sessionId: row.sessionId,
    clientEventId: row.clientEventId,
    sourceLogId: row.sourceLogId,
    submittedAt: row.submittedAt,
    responseData: row.responseData,
  });
}

/**
 * 从持久化证据行重建 LearningEvent 并经 canonical ingest 物化 LearningFact。
 * 与提交快路径共用 ingestLearningFact（幂等：sourceEventId 唯一约束 + skipDuplicates）。
 */
export async function materializeEvidenceRow(
  db: { learningFact: unknown },
  evidence: ClosureEvidenceRow,
): Promise<boolean> {
  const clientEventId = evidence.clientEventId;
  if (!clientEventId) return false;
  const responseData = readRecord(evidence.responseData);
  const actionType = typeof responseData.eventType === 'string' && responseData.eventType.trim().length > 0
    ? responseData.eventType
    : 'lesson_submit';
  const classId = typeof responseData.classId === 'string' && responseData.classId.trim().length > 0
    ? responseData.classId.trim()
    : undefined;
  const learningEvent = toLearningEvent({
    id: clientEventId,
    eventId: clientEventId,
    type: actionType,
    actionType,
    timestamp: evidence.submittedAt.getTime(),
    sessionId: evidence.sessionId,
    lessonKey: typeof responseData.lessonKey === 'string' ? responseData.lessonKey : undefined,
    stepId: typeof responseData.stepId === 'string' ? responseData.stepId : undefined,
    attemptKey: typeof responseData.attemptKey === 'string' ? responseData.attemptKey : undefined,
    actorRole: 'student',
    resourceKey: typeof responseData.resourceKey === 'string' ? responseData.resourceKey : '',
    priority: 'core',
    payload: {
      ...responseData,
      clientEventId,
      ...(evidence.sourceLogId ? { sourceLogId: evidence.sourceLogId } : {}),
    },
  }, {
    userId: evidence.userId,
    role: 'student',
    pagePath: typeof responseData.originPath === 'string' ? responseData.originPath : '/classroom-closure-replay',
    pageType: 'classroom',
  });
  const result = await ingestLearningFact({
    db: db as IngestionWriteDb,
    transport: 'direct',
    event: learningEvent,
    actorUserId: evidence.userId,
    captureRevision: currentCaptureRevision(),
    classId,
  });
  return result.status === INGESTION_STATUS.applied
    || result.status === INGESTION_STATUS.deduplicated;
}
