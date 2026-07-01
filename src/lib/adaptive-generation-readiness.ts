export type AdaptiveGenerationReadinessStatus = 'ready' | 'blocked' | 'degraded' | 'retryable';

export type AdaptiveGenerationReadinessReason =
  | 'ready'
  | 'missing-class-binding'
  | 'missing-teacher-binding'
  | 'learner-state-unavailable'
  | 'advisor-forbidden'
  | 'service-unavailable'
  | 'insufficient-evidence'
  | 'retryable';

export type AdaptiveGenerationStudentAction =
  | 'continue-practice'
  | 'request-teacher-binding'
  | 'retry'
  | 'review-evidence'
  | 'choose-demo';

export type AdaptiveGenerationStaffAction =
  | 'bind-class'
  | 'check-service'
  | 'review-permission'
  | 'inspect-evidence'
  | 'none';

export interface AdaptiveGenerationReadiness {
  status: AdaptiveGenerationReadinessStatus;
  reason: AdaptiveGenerationReadinessReason;
  studentAction: AdaptiveGenerationStudentAction;
  staffAction: AdaptiveGenerationStaffAction;
  studentMessage: string;
  staffMessage: string;
  evidence: {
    source: 'session' | 'learner-state' | 'path-advisor' | 'path-advisor-tool' | 'ui';
    diagnosticCode: AdaptiveGenerationReadinessReason;
    safeLabel: string;
  };
}

export const adaptiveGenerationReady: AdaptiveGenerationReadiness = {
  status: 'ready',
  reason: 'ready',
  studentAction: 'continue-practice',
  staffAction: 'none',
  studentMessage: '路径生成条件已就绪。',
  staffMessage: '路径生成上下文已签发，可以继续生成。',
  evidence: {
    source: 'ui',
    diagnosticCode: 'ready',
    safeLabel: 'ready',
  },
};

const readinessByReason: Record<Exclude<AdaptiveGenerationReadinessReason, 'ready'>, Omit<AdaptiveGenerationReadiness, 'reason' | 'evidence'>> = {
  'missing-class-binding': {
    status: 'blocked',
    studentAction: 'request-teacher-binding',
    staffAction: 'bind-class',
    studentMessage: '当前账号还没有绑定班级，请联系任课教师加入班级后再生成学习路径。',
    staffMessage: '需要为学生绑定班级，或确认学生是否使用了正确账号。',
  },
  'missing-teacher-binding': {
    status: 'blocked',
    studentAction: 'request-teacher-binding',
    staffAction: 'bind-class',
    studentMessage: '当前班级还没有绑定任课教师，请联系管理员或教师完成班级设置。',
    staffMessage: '班级缺少 teacherId，路径生成无法确定教师作用域。',
  },
  'learner-state-unavailable': {
    status: 'degraded',
    studentAction: 'review-evidence',
    staffAction: 'check-service',
    studentMessage: '学习状态服务暂时不可用。你仍可查看已有证据和基础建议，稍后再生成个性化路径。',
    staffMessage: '检查 learner-state 服务、特性开关和数据治理 worker 状态。',
  },
  'advisor-forbidden': {
    status: 'blocked',
    studentAction: 'request-teacher-binding',
    staffAction: 'review-permission',
    studentMessage: '当前账号暂不能使用路径顾问，请联系教师确认权限和班级设置。',
    staffMessage: '检查 path-advisor scope、学生身份、班级和图谱节点签名。',
  },
  'service-unavailable': {
    status: 'retryable',
    studentAction: 'retry',
    staffAction: 'check-service',
    studentMessage: '路径生成服务暂时不可用。已有证据不会丢失，请稍后重试。',
    staffMessage: '检查路径顾问上下文签发、控灵运行时和服务配置。',
  },
  'insufficient-evidence': {
    status: 'degraded',
    studentAction: 'continue-practice',
    staffAction: 'inspect-evidence',
    studentMessage: '当前学习证据还不充分。你可以先继续练习或查看证据，再生成更可靠的路径。',
    staffMessage: '检查学生 LearningFact、课堂证据和路径执行记录覆盖情况。',
  },
  retryable: {
    status: 'retryable',
    studentAction: 'retry',
    staffAction: 'check-service',
    studentMessage: '路径生成依赖暂时没有响应，请稍后重试。',
    staffMessage: '检查临时网络、数据库或上游服务失败日志。',
  },
};

export function buildAdaptiveGenerationReadiness(input: {
  reason: AdaptiveGenerationReadinessReason;
  source: AdaptiveGenerationReadiness['evidence']['source'];
  safeLabel?: string;
}): AdaptiveGenerationReadiness {
  if (input.reason === 'ready') {
    return {
      ...adaptiveGenerationReady,
      evidence: {
        source: input.source,
        diagnosticCode: 'ready',
        safeLabel: input.safeLabel ?? 'ready',
      },
    };
  }
  const config = readinessByReason[input.reason];
  return {
    ...config,
    reason: input.reason,
    evidence: {
      source: input.source,
      diagnosticCode: input.reason,
      safeLabel: input.safeLabel ?? input.reason,
    },
  };
}

export function adaptiveGenerationReadinessFromHttp(input: {
  status: number;
  source: AdaptiveGenerationReadiness['evidence']['source'];
  fallbackReason?: AdaptiveGenerationReadinessReason;
}): AdaptiveGenerationReadiness {
  if (input.fallbackReason) {
    return buildAdaptiveGenerationReadiness({ reason: input.fallbackReason, source: input.source });
  }
  if (input.status === 403) {
    return buildAdaptiveGenerationReadiness({ reason: 'advisor-forbidden', source: input.source });
  }
  if (input.status === 503) {
    return buildAdaptiveGenerationReadiness({ reason: 'service-unavailable', source: input.source });
  }
  if (input.status >= 500) {
    return buildAdaptiveGenerationReadiness({ reason: 'retryable', source: input.source });
  }
  return buildAdaptiveGenerationReadiness({
    reason: 'service-unavailable',
    source: input.source,
  });
}

export function selectAdaptiveGenerationReadiness(
  candidates: Array<AdaptiveGenerationReadiness | null | undefined>,
): AdaptiveGenerationReadiness {
  const present = candidates.filter((candidate): candidate is AdaptiveGenerationReadiness => Boolean(candidate));
  return present.find((candidate) => candidate.status === 'blocked') ??
    present.find((candidate) => candidate.status === 'retryable') ??
    present.find((candidate) => candidate.status === 'degraded') ??
    adaptiveGenerationReady;
}
