import { Prisma } from '@prisma/client';

import { ClassroomSessionError } from './errors';

/**
 * 分类提交身份规范化版本。身份公式变更必须产生新版本号，并记录在
 * StudentStepResponse.identityVersion / InteractionLog 事件载荷中。
 */
export const CLASSROOM_SUBMISSION_IDENTITY_VERSION = 'classroom-submission-identity-v1';

/**
 * 活跃会话可接受分类提交的状态。PAUSED 属于闭课前的临时暂停，
 * 与 ACTIVE 一样处于 end 水位边界之前；仅 FINISHED 之后的到达为课后复盘。
 */
export const PRE_CLOSURE_SESSION_STATUSES = ['ACTIVE', 'PAUSED'] as const;

/** 晚到证据的显式状态：保留为证据但不进入原闭包，默认报告排除。 */
export const POST_SESSION_REVIEW_EVIDENCE_STATUS = 'POST_SESSION_REVIEW';
export const ACCEPTED_EVIDENCE_STATUS = 'ACCEPTED';

export interface CanonicalSubmissionIdentityInput {
  sessionId: string;
  userId: string;
  lessonKey?: string | null;
  stepId: string;
  cardId?: string | null;
  attemptKey?: string | null;
  clientEventId?: string | null;
}

export interface CanonicalSubmissionIdentity {
  identity: string;
  identityVersion: string;
}

/**
 * 从 session/student/lesson/step/card/attempt/client event 输入推导非空确定提交身份。
 * 组件顺序沿用既有应用层去重键（userId|sessionId|lessonKey|stepId|cardId|attempt），
 * attempt 缺失时回退 clientEventId；两者皆缺则无法分类，返回 null。
 */
export function buildCanonicalSubmissionIdentity(
  input: CanonicalSubmissionIdentityInput,
): CanonicalSubmissionIdentity | null {
  const sessionId = input.sessionId?.trim() ?? '';
  const userId = input.userId?.trim() ?? '';
  const stepId = input.stepId?.trim() ?? '';
  const attempt = input.attemptKey?.trim() || input.clientEventId?.trim() || '';
  if (!sessionId || !userId || !stepId || !attempt) {
    return null;
  }
  const identity = [
    userId,
    sessionId,
    input.lessonKey?.trim() ?? '',
    stepId,
    input.cardId?.trim() || 'step',
    attempt,
  ].join('|');
  return { identity, identityVersion: CLASSROOM_SUBMISSION_IDENTITY_VERSION };
}

/** 提交写入器返回的持久化回执：重复投递返回原证据回执，绝不覆盖先前作答。 */
export interface ClassroomSubmissionEvidenceReceipt {
  /** ACCEPTED：进入水位内；POST_SESSION_REVIEW：晚到复盘；DUPLICATE：同身份已持久化 */
  status: 'ACCEPTED' | 'POST_SESSION_REVIEW' | 'DUPLICATE';
  /** 持久化证据行的实际分类（DUPLICATE 时指向已存在行） */
  evidenceStatus: string;
  evidenceId: string;
  sourceLogId: string;
  submissionIdentity: string;
  identityVersion: string;
  /** ACCEPTED 时为本会话内单调序列；POST_SESSION_REVIEW / 历史行为 null */
  submissionSequence: bigint | null;
  /** 写入决策时会话状态 */
  sessionStatus: string;
}

/** 提交事务的源事件与响应载荷；由调用方（事件路由）完成规范化与信任注入。 */
export interface ClassifiedSubmissionWriteInput {
  userId: string;
  submissionIdentity: string;
  identityVersion: string;
  sourceEvent: {
    resourceId: string | null;
    resourceKey: string | null;
    sessionId: string;
    lessonKey: string | null;
    stepId: string;
    actorRole: string | null;
    eventType: string;
    clientEventId: string | null;
    learningContext: string | null;
    invalidContextReason: string | null;
    eventData: Prisma.InputJsonValue;
    clientEventAt: Date | null;
  };
  response: {
    lessonKey: string | null;
    stepId: string;
    attemptKey: string | null;
    clientEventId: string | null;
    submittedAt: Date;
    /**
     * 写入器在事务内创建源 InteractionLog 后以真实 sourceLogId 调用，
     * 保证响应载荷（含嵌入证据草稿）的源血缘是持久化 id 而非占位符。
     */
    buildResponseData: (sourceLogId: string) => Prisma.InputJsonObject;
  };
}

export interface ClassroomSubmissionEvidenceRuntime {
  acceptClassifiedSubmission(input: ClassifiedSubmissionWriteInput): Promise<ClassroomSubmissionEvidenceReceipt>;
}

export type ClassroomSubmissionEvidencePort = ClassroomSubmissionEvidenceRuntime;

export async function acceptClassroomSubmissionEvidence(
  runtime: ClassroomSubmissionEvidenceRuntime,
  input: ClassifiedSubmissionWriteInput,
): Promise<ClassroomSubmissionEvidenceReceipt> {
  if (!input.submissionIdentity || !input.identityVersion) {
    throw new ClassroomSessionError('invalid-input', 'Classified submission requires a canonical identity');
  }
  if (!input.sourceEvent.sessionId || !input.sourceEvent.stepId) {
    throw new ClassroomSessionError('invalid-input', 'Classified submission requires session and step');
  }
  return runtime.acceptClassifiedSubmission(input);
}

/**
 * 显式只读上下文包装：preview / 只读渲染路径使用。任何写端口调用都会被
 * 以可观察原因拒绝，保证 preview 不产生学生状态、提交或证据。
 */
export class ReadOnlyClassroomContextError extends Error {
  readonly code = 'preview-read-only';

  constructor(operation: string) {
    super(`Classroom write port '${operation}' rejected: preview context is read-only`);
    this.name = 'ReadOnlyClassroomContextError';
  }
}

export function createReadOnlySubmissionEvidencePort(): ClassroomSubmissionEvidencePort {
  return {
    acceptClassifiedSubmission: async () => {
      throw new ReadOnlyClassroomContextError('acceptClassifiedSubmission');
    },
  };
}
