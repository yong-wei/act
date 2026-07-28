export interface AdaptiveAttemptQuestionSnapshot {
  version: 'adaptive-question-snapshot.v1';
  prompt: string;
  options: Array<{
    key: string;
    label: string;
    text: string;
    explanation: string;
  }>;
  correctOptionKey: string;
  explanation: string;
  knowledgeTags: string[];
  misconceptionTags: string[];
  remediationResources: Array<{
    id: string;
    title: string;
    href: string;
    governanceState: 'reviewed';
  }>;
}

export interface AdaptiveAttemptContextItem {
  answerId: string;
  questionId: string;
  selectedOptionKey: string;
  correctOptionKey: string;
  isCorrect: boolean;
  answeredAt: string;
  misconceptionTags: string[];
}

export interface AdaptiveAttemptContext extends AdaptiveAttemptContextItem {
  sessionKey: string;
  question: AdaptiveAttemptQuestionSnapshot;
  recentAttempts: AdaptiveAttemptContextItem[];
}

interface AdaptiveAttemptAnswerRow {
  id: string;
  userId: string;
  sessionId: string;
  questionId: string;
  selectedOptionKey: string;
  correctOptionKey: string;
  isCorrect: boolean;
  answeredAt: Date;
  session: {
    id: string;
    userId: string;
    sessionKey: string;
  };
  questionRef: {
    knowledgeTags: string[];
    metadata: unknown;
  };
}

export interface AdaptiveAttemptContextDb {
  adaptiveAssessmentAnswer: {
    findFirst(input: any): Promise<AdaptiveAttemptAnswerRow | null>;
    findMany(input: any): Promise<AdaptiveAttemptAnswerRow[]>;
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => !string(item))) return null;
  return value.map((item) => string(item)!);
}

function parseQuestionSnapshot(value: unknown): AdaptiveAttemptQuestionSnapshot | null {
  const snapshot = record(value);
  if (!snapshot || snapshot.version !== 'adaptive-question-snapshot.v1') return null;
  const prompt = string(snapshot.prompt);
  const correctOptionKey = string(snapshot.correctOptionKey);
  const explanation = string(snapshot.explanation);
  const knowledgeTags = stringArray(snapshot.knowledgeTags);
  const misconceptionTags = stringArray(snapshot.misconceptionTags);
  if (!prompt || !correctOptionKey || !explanation || !knowledgeTags || !misconceptionTags) return null;
  if (!Array.isArray(snapshot.options) || snapshot.options.length < 2) return null;

  const options = snapshot.options.flatMap((value) => {
    const option = record(value);
    const key = string(option?.key);
    const label = string(option?.label);
    const text = string(option?.text);
    const optionExplanation = string(option?.explanation);
    return key && label && text && optionExplanation
      ? [{ key, label, text, explanation: optionExplanation }]
      : [];
  });
  if (options.length !== snapshot.options.length || !options.some((option) => option.key === correctOptionKey)) {
    return null;
  }

  const remediationResources = Array.isArray(snapshot.remediationResources)
    ? snapshot.remediationResources.flatMap((value) => {
        const resource = record(value);
        const id = string(resource?.id);
        const title = string(resource?.title);
        const href = string(resource?.href);
        return id && title && href && resource?.governanceState === 'reviewed'
          ? [{ id, title, href, governanceState: 'reviewed' as const }]
          : [];
      })
    : [];

  return {
    version: 'adaptive-question-snapshot.v1',
    prompt,
    options,
    correctOptionKey,
    explanation,
    knowledgeTags,
    misconceptionTags,
    remediationResources,
  };
}

function toContextItem(
  answer: AdaptiveAttemptAnswerRow,
  question: AdaptiveAttemptQuestionSnapshot,
): AdaptiveAttemptContextItem {
  return {
    answerId: answer.id,
    questionId: answer.questionId,
    selectedOptionKey: answer.selectedOptionKey,
    correctOptionKey: answer.correctOptionKey,
    isCorrect: answer.isCorrect,
    answeredAt: answer.answeredAt.toISOString(),
    misconceptionTags: question.misconceptionTags,
  };
}

const answerInclude = {
  session: {
    select: { id: true, userId: true, sessionKey: true },
  },
  questionRef: {
    select: { knowledgeTags: true, metadata: true },
  },
};

export async function readAdaptiveAttemptContext(input: {
  db: AdaptiveAttemptContextDb;
  authenticatedUserId: string;
  answerId: string;
}): Promise<AdaptiveAttemptContext | null> {
  const current = await input.db.adaptiveAssessmentAnswer.findFirst({
    where: { id: input.answerId, userId: input.authenticatedUserId },
    include: answerInclude,
  });
  if (!current || current.session.userId !== input.authenticatedUserId) return null;

  const metadata = record(current.questionRef.metadata);
  const question = parseQuestionSnapshot(metadata?.questionSnapshot);
  if (!question || question.correctOptionKey !== current.correctOptionKey) return null;

  const recent = await input.db.adaptiveAssessmentAnswer.findMany({
    where: { userId: input.authenticatedUserId, sessionId: current.sessionId },
    include: answerInclude,
    orderBy: [{ answeredAt: 'desc' }, { id: 'desc' }],
    take: 3,
  });

  const recentAttempts = recent.flatMap((answer) => {
    if (
      answer.userId !== input.authenticatedUserId ||
      answer.sessionId !== current.sessionId ||
      answer.session.userId !== input.authenticatedUserId ||
      answer.session.id !== current.sessionId
    ) {
      return [];
    }
    const recentMetadata = record(answer.questionRef.metadata);
    const recentQuestion = parseQuestionSnapshot(recentMetadata?.questionSnapshot);
    return recentQuestion && recentQuestion.correctOptionKey === answer.correctOptionKey
      ? [toContextItem(answer, recentQuestion)]
      : [];
  });
  if (recentAttempts.length !== recent.length) return null;

  return {
    ...toContextItem(current, question),
    sessionKey: current.session.sessionKey,
    question,
    recentAttempts,
  };
}
