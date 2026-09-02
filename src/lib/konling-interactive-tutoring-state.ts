import { resolveInteractiveLessonRegistryKey } from '@/lib/course-ai-contexts';

/**
 * 互动课程控灵的服务端作答状态投影。
 *
 * 状态只来自服务端持久化记录（StudentState 实时投影、StudentStepResponse
 * 提交证据、教师 teacher-sync 揭示行）。客户端提交的 tools、
 * systemPromptExtension、answerVisible 等字段不参与解析，也不能扩大权限。
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

/** 课堂会话路由中的会话 id 只作为查找提示，成员资格仍由服务端校验。 */
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

const STATE_RULES: Record<InteractiveTutoringStatus, string> = {
  unresolved: '当前互动步骤未能解析课堂作答状态，不得声称已读取学生作答，不得检查答案或给出答案。',
  unanswered: '本页所需响应尚未确认提交，禁止给出答案、检查答案或生成提交内容。',
  in_progress: '本页已有部分作答保存但尚未完整提交，仍禁止检查答案或声称作答已经完成。',
  submitted: '本页作答已经确认提交，可以基于该学生自己的已提交作答做受限检查与解释，但不得代写或替学生提交。',
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
      select: { data: true };
    }): Promise<{ data: unknown } | null>;
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
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
}

export async function resolveInteractiveTutoringState(
  db: InteractiveTutoringDb,
  input: {
    authenticatedUserId: string;
    role: string | undefined;
    /** 已授权页面的 courseId/pageId（注册表键），不是客户端原始字符串。 */
    courseId: string;
    pageId: string;
    sessionIdHint: string | null;
  },
): Promise<InteractiveTutoringState | null> {
  const lessonKey = resolveInteractiveLessonRegistryKey(input.courseId);
  if (!lessonKey) return null;

  if (!input.sessionIdHint) {
    return tutoringState('unresolved', null);
  }

  // 教师预览不产生学生状态；管理员同理，均按 unresolved 降级。
  if (input.role !== 'STUDENT') {
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
      select: { data: true },
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
        stepId: input.pageId,
      },
      orderBy: { submittedAt: 'desc' },
      select: { id: true },
    }),
  ]);

  const learnerAnswers = readLearnerAnswers(courseStateRow?.data, input.pageId);
  const disclosed = readRevealedStep(teacherSyncRow?.data, input.pageId);
  const submitted = Boolean(submittedRow);

  if (disclosed) return tutoringState('teacher_disclosed', learnerAnswers);
  if (submitted) return tutoringState('submitted', learnerAnswers);
  if (learnerAnswers) return tutoringState('in_progress', learnerAnswers);
  return tutoringState('unanswered', null);
}
