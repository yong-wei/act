import { resolveInteractiveLessonRegistryKey } from '@/lib/course-ai-contexts';
import { loadSessionBoundLessonRuntime } from '@/lib/course-bundle/session-reader';
import { resolveInteractiveLessonIdentity } from '@/lib/interactive-lesson-identity';

/**
 * 互动课程控灵的服务端作答状态投影。
 *
 * 状态只来自服务端持久化记录（StudentState 实时投影、StudentStepResponse
 * 提交证据、教师 teacher-sync 揭示行）与已发布的 runtime manifest。客户端
 * 提交的 tools、systemPromptExtension、answerVisible 等字段不参与解析，
 * 也不能扩大权限。
 */

export type InteractiveTutoringStatus =
  | 'unresolved'
  | 'unanswered'
  | 'in_progress'
  | 'submitted'
  | 'teacher_disclosed';

export interface InteractiveTutoringState {
  status: InteractiveTutoringStatus;
  /** 写入系统提示词的辅导规则；unresolved 时不声明任何作答感知。 */
  stateRule: string;
  /** 是否允许对学生本页作答做受限检查。 */
  checkAnswerAllowed: boolean;
  /** 追加到系统提示词的完整小节。 */
  promptSection: string;
}

/** 嵌入式互动资源 id 前缀（`<prefix>:<stepId>`）到课次键的映射，仅收录实际存在嵌入式 AI 的课。 */
const EMBEDDED_RESOURCE_LESSON_PREFIXES: Record<string, string> = {
  unit11: 'unit-1-1-see-the-full-picture-v1',
  unit21: 'unit-2-1-modeling-language-v1',
  unit22: 'unit-2-2-time-domain-response-v1',
  unit23: 'unit-2-3-frequency-response-bode-intro-v1',
  unit24: 'unit-2-4-nyquist-margin-entry-v1',
  unit41: 'unit-4-1-design-task-expression-v1',
};

/** 课堂会话路由中的会话 id 只作为查找提示，成员资格与课次绑定仍由服务端校验。 */
export function extractInteractiveSessionHint(hint: unknown): string | null {
  if (typeof hint !== 'object' || hint === null) return null;
  const candidates: unknown[] = [
    (hint as { url?: unknown }).url,
    (hint as { stepId?: unknown }).stepId,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.length === 0) continue;
    const match = candidate.match(/\/(?:student|classroom)\/([^/?#]+)/);
    if (match) {
      const sessionId = decodeURIComponent(match[1]);
      return sessionId.trim().length > 0 ? sessionId : null;
    }
  }
  return null;
}

export interface InteractiveLessonTarget {
  lessonKey: string;
  stepId: string;
}

/**
 * 把已授权的 courseId/pageId 解析到具体课次键与步骤 id。
 * 覆盖两个入口：注册表键（全局控灵）与嵌入式互动资源路径
 * （`/interactive-learning/resources/<rid>/classroom/<sid>`）。
 */
export function resolveInteractiveLessonTarget(
  courseId: string,
  pageId: string,
): InteractiveLessonTarget | null {
  const registryKey = resolveInteractiveLessonRegistryKey(courseId);
  if (registryKey) return { lessonKey: registryKey, stepId: pageId };

  const resourceMatch = pageId.match(/^\/interactive-learning\/resources\/([^/]+)\/classroom\//);
  if (resourceMatch) {
    const resourceId = decodeURIComponent(resourceMatch[1]);
    const separator = resourceId.indexOf(':');
    if (separator > 0) {
      const lessonKey = EMBEDDED_RESOURCE_LESSON_PREFIXES[resourceId.slice(0, separator)] ?? null;
      const stepId = resourceId.slice(separator + 1);
      if (lessonKey && stepId && resolveInteractiveLessonRegistryKey(lessonKey) === lessonKey) {
        return { lessonKey, stepId };
      }
    }
  }
  return null;
}

const STATE_RULES: Record<InteractiveTutoringStatus, string> = {
  unresolved: '当前互动步骤未能解析课堂作答状态，不得声称已读取学生作答，不得检查答案或给出答案。',
  unanswered: '本页所需响应尚未确认提交，禁止给出答案、检查答案或生成提交内容。',
  in_progress: '本页作答尚未完整提交，仍禁止检查答案或声称作答已经完成。',
  submitted: '本页作答已经完整提交，可以基于该学生自己的已提交作答做受限检查与解释，但不得代写或替学生提交。',
  teacher_disclosed: '教师已经揭示本页答案，可以基于该学生自己的作答与已揭示材料解释，但不得代写或替学生提交。',
};

const MAX_SUMMARY_ENTRIES = 10;
const MAX_SUMMARY_VALUE_LENGTH = 200;

function tutoringState(
  status: InteractiveTutoringStatus,
  learnerAnswers: Record<string, string> | null,
): InteractiveTutoringState {
  const checkAnswerAllowed = status === 'submitted' || status === 'teacher_disclosed';
  const stateRule = STATE_RULES[status];
  const summary = checkAnswerAllowed && learnerAnswers
    ? summarizeLearnerAnswers(learnerAnswers)
    : null;
  return {
    status,
    stateRule,
    checkAnswerAllowed,
    promptSection: [
      '互动辅导状态（服务端按持久化作答解析，客户端自报字段不作授权依据）：',
      stateRule,
      summary ? `该学生本页已提交作答（仅用于受限检查与解释）：${summary}` : '',
    ].filter(Boolean).join('\n'),
  };
}

function summarizeLearnerAnswers(answers: Record<string, string>): string | null {
  const entries = Object.entries(answers).slice(0, MAX_SUMMARY_ENTRIES);
  if (entries.length === 0) return null;
  return entries
    .map(([key, value]) => {
      const text = typeof value === 'string' ? value : JSON.stringify(value);
      const bounded = text.length > MAX_SUMMARY_VALUE_LENGTH
        ? `${text.slice(0, MAX_SUMMARY_VALUE_LENGTH)}…`
        : text;
      return `${key}=${bounded}`;
    })
    .join('；');
}

function readLearnerAnswers(courseStateData: unknown, stepId: string): Record<string, string> | null {
  if (typeof courseStateData !== 'object' || courseStateData === null) return null;
  const responses = (courseStateData as { responses?: unknown }).responses;
  if (typeof responses !== 'object' || responses === null) return null;
  const stepResponse = (responses as Record<string, unknown>)[stepId];
  if (typeof stepResponse !== 'object' || stepResponse === null) return null;
  const answers = (stepResponse as { answers?: unknown }).answers;
  if (typeof answers !== 'object' || answers === null) return null;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = String(value);
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

/** 提交证据行的 responseData 顶层 answers（提交时点不可变记录）。 */
function readEvidenceAnswers(responseData: unknown): Record<string, string> | null {
  if (typeof responseData !== 'object' || responseData === null) return null;
  const answers = (responseData as { answers?: unknown }).answers;
  if (typeof answers !== 'object' || answers === null) return null;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(answers as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = String(value);
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

function readRevealedStep(teacherSyncData: unknown, stepId: string): boolean {
  if (typeof teacherSyncData !== 'object' || teacherSyncData === null) return false;
  const revealed = (teacherSyncData as { revealedAnswers?: unknown }).revealedAnswers;
  if (typeof revealed !== 'object' || revealed === null) return false;
  return (revealed as Record<string, unknown>)[stepId] === true;
}

/** 与 Prisma client 结构兼容的最小查询端口，便于测试替换。 */
export interface InteractiveTutoringDb {
  classSession: {
    findUnique(args: { where: { id: string }; select: { classId: true } }): Promise<{ classId: string | null } | null>;
  };
  studentProfile: {
    findFirst(args: { where: { userId: string; classId: string | null }; select: { userId: true } }): Promise<{ userId: string } | null>;
  };
  studentState: {
    findUnique(args: {
      where: { sessionId_userId_stateKey: { sessionId: string; userId: string; stateKey: string } };
      select: { data: true; lessonKey: true };
    }): Promise<{ data: unknown; lessonKey: string | null } | null>;
    findFirst(args: {
      where: { sessionId: string; stateKey: string; itemId: string };
      orderBy: { submittedAt: 'desc' };
      select: { data: true };
    }): Promise<{ data: unknown } | null>;
  };
  studentStepResponse: {
    findFirst(args: {
      where: { sessionId: string; userId: string; lessonKey: string; stepId: string };
      orderBy: { submittedAt: 'desc' };
      select: { responseData: true };
    }): Promise<{ responseData: unknown } | null>;
  };
}

export async function resolveInteractiveTutoringState(
  db: InteractiveTutoringDb,
  input: {
    authenticatedUserId: string;
    role: string | undefined;
    /** 已授权页面的 courseId/pageId（注册表键或嵌入式资源路径），不是客户端原始字符串。 */
    courseId: string;
    pageId: string;
    sessionIdHint: string | null;
  },
): Promise<InteractiveTutoringState | null> {
  const target = resolveInteractiveLessonTarget(input.courseId, input.pageId);
  if (!target) return null;
  const { lessonKey, stepId } = target;

  if (!input.sessionIdHint) {
    return tutoringState('unresolved', null);
  }

  // 教师预览不产生学生状态；管理员同理，均按 unresolved 降级。
  if (input.role !== 'STUDENT') {
    return tutoringState('unresolved', null);
  }

  // 课次与修订锚定：通过课堂绑定的不可变 course bundle 校验会话确实属于
  // 当前课次，并从该绑定修订读取 manifest（release-pinned + 哈希校验）。
  // 学生可通过 state API 改写的实时行不作为锚点。
  const identity = resolveInteractiveLessonIdentity({ value: lessonKey, kind: 'lessonKey' });
  if (identity.status !== 'resolved') return tutoringState('unresolved', null);
  const boundRuntime = await loadSessionBoundLessonRuntime({
    sessionId: input.sessionIdHint,
    expectedCanonicalId: identity.record.canonicalId,
    role: 'student',
  });
  if (boundRuntime.status !== 'bound') {
    return tutoringState('unresolved', null);
  }

  const session = await db.classSession.findUnique({
    where: { id: input.sessionIdHint },
    select: { classId: true },
  });
  if (!session) {
    return tutoringState('unresolved', null);
  }

  const membership = await db.studentProfile.findFirst({
    where: { userId: input.authenticatedUserId, classId: session.classId },
    select: { userId: true },
  });
  if (!membership) {
    return tutoringState('unresolved', null);
  }

  const [courseStateRow, teacherSyncRow, submittedRow] = await Promise.all([
    db.studentState.findUnique({
      where: {
        sessionId_userId_stateKey: {
          sessionId: input.sessionIdHint,
          userId: input.authenticatedUserId,
          stateKey: 'course',
        },
      },
      select: { data: true, lessonKey: true },
    }),
    db.studentState.findFirst({
      where: { sessionId: input.sessionIdHint, stateKey: 'teacher-sync', itemId: 'teacher:course-sync' },
      orderBy: { submittedAt: 'desc' },
      select: { data: true },
    }),
    db.studentStepResponse.findFirst({
      where: {
        sessionId: input.sessionIdHint,
        userId: input.authenticatedUserId,
        lessonKey,
        stepId,
      },
      orderBy: { submittedAt: 'desc' },
      select: { responseData: true },
    }),
  ]);

  const manifestStep = boundRuntime.lessonRuntime.interactiveManifest?.steps.find((item) => item.id === stepId) ?? null;
  const requiredKeys = manifestStep
    ? new Set([
        ...(manifestStep.interactionSpec.activityCards ?? []).map((card) => card.id),
        ...manifestStep.modules
          .filter((module) => module.kind === 'compute.panel')
          .map((module) => module.payload.responseContractId)
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
      ])
    : null;

  // 完整提交以提交证据行为权威（提交时点的不可变记录）：必答项全部在
  // evidence answers 中且值非空。可反复覆写的实时投影不参与完整性判定。
  const evidenceAnswers = readEvidenceAnswers(submittedRow?.responseData);
  const learnerAnswers = readLearnerAnswers(courseStateRow?.data, stepId);
  const disclosed = readRevealedStep(teacherSyncRow?.data, stepId);
  const completelySubmitted = requiredKeys !== null
    && submittedRow !== null
    && evidenceAnswers !== null
    && [...requiredKeys].every((key) => {
      const value = evidenceAnswers[key];
      return typeof value === 'string' && value.trim().length > 0;
    });

  if (disclosed) return tutoringState('teacher_disclosed', evidenceAnswers ?? learnerAnswers);
  if (completelySubmitted) return tutoringState('submitted', evidenceAnswers);
  if (learnerAnswers) return tutoringState('in_progress', learnerAnswers);
  return tutoringState('unanswered', null);
}
