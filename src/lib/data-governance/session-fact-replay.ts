import type { Prisma } from '@prisma/client';

import { persistCoreLearningFact } from './learning-fact-materialization';
import { toLearningEvent } from './event-protocol';
import type { ClosureEvidenceRow } from './session-closure-phases';

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/**
 * 从持久化证据行重建 LearningEvent 并物化 LearningFact。
 * 与提交时的内联快路径共用 persistCoreLearningFact（幂等：sourceEventId 唯一
 * 约束 + skipDuplicates），是闭包 materialize 阶段与 DUPLICATE 回执重放的
 * 共同实现——不存在第二条物化语义。
 */
export async function materializeEvidenceRow(
  db: Parameters<typeof persistCoreLearningFact>[0],
  evidence: ClosureEvidenceRow,
): Promise<boolean> {
  const clientEventId = evidence.clientEventId;
  if (!clientEventId) return false;
  const responseData = readRecord(evidence.responseData);
  const actionType = typeof responseData.eventType === 'string' && responseData.eventType.trim().length > 0
    ? responseData.eventType
    : 'lesson_submit';
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
  const result = await persistCoreLearningFact(db, learningEvent);
  return result.created > 0;
}
