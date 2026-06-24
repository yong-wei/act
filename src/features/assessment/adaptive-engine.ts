import {
  PRESET_QUESTIONS,
  buildGeneratedQuestion,
  type CrossDomainQuestion,
  type QuestionDomain,
  type QuestionType,
} from '@/features/assessment/adaptive-question-bank';
import { buildKaqQuizQuestionMetadata } from '@/features/adaptive-assessment/kaq-quiz-foundation';

export interface AdaptiveAnswerRecord {
  sessionId: string;
  userId: string;
  questionId: string;
  isCorrect: boolean;
  timeSpent: number;
  selectedOption: string;
  difficulty: number;
  knowledgeTags: string[];
  questionType?: QuestionType;
  domains?: QuestionDomain[];
  createdAt: number;
}

export interface SubmitAnswerParams {
  userId: string;
  sessionId: string;
  questionId: string;
  selectedOption: string;
  timeSpent: number;
  pathContext?: {
    pathId: string;
    nodeId: string;
    goalId?: string | null;
    routeIntent?: string | null;
  };
}

export interface SubmitAnswerResult {
  isCorrect: boolean;
  correctOption: string;
  explanation: string;
  estimatedAbility: number;
  recommendedFocus: string[];
}

export interface SubmittedAnswerDetails {
  result: SubmitAnswerResult;
  record: AdaptiveAnswerRecord;
  question: CrossDomainQuestion;
  selectedOptionKey: string;
  correctOptionKey: string;
  pathContext?: SubmitAnswerParams['pathContext'];
}

interface SessionState {
  userId: string;
  askedQuestionIds: Set<string>;
}

interface AdaptiveStore {
  sessions: Map<string, SessionState>;
  answersByUser: Map<string, AdaptiveAnswerRecord[]>;
  generatedQuestions: Map<string, CrossDomainQuestion>;
}

export interface DiagnosticResult {
  knowledgeDimensions: {
    computational: number;
    crossDomain: number;
    design: number;
  };
  weakAreas: string[];
  recommendedFocus: string[];
}

export interface PublicQuestion extends Omit<CrossDomainQuestion, 'options'> {
  options: Array<{ label: string; text: string; explanation: string }>;
}

export interface AbilityReport {
  userId: string;
  estimatedAbility: number;
  confidenceInterval: [number, number];
  timeline: Array<{ timestamp: number; theta: number; accuracy: number }>;
  dimensions: {
    computationalTheta: number;
    crossDomainTheta: number;
    designTheta: number;
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __adaptiveAssessmentStore: AdaptiveStore | undefined;
}

function createStore(): AdaptiveStore {
  if (!globalThis.__adaptiveAssessmentStore) {
    globalThis.__adaptiveAssessmentStore = {
      sessions: new Map<string, SessionState>(),
      answersByUser: new Map<string, AdaptiveAnswerRecord[]>(),
      generatedQuestions: new Map<string, CrossDomainQuestion>(),
    };
  }
  return globalThis.__adaptiveAssessmentStore;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toPublicQuestion(question: CrossDomainQuestion): PublicQuestion {
  return {
    ...question,
    options: question.options.map((option) => ({
      label: option.label,
      text: option.text,
      explanation: option.explanation,
    })),
  };
}

export function getAdaptiveQuestionById(questionId: string): CrossDomainQuestion | null {
  const store = createStore();
  const preset = PRESET_QUESTIONS.find((question) => question.id === questionId);
  if (preset) {
    return preset;
  }
  return store.generatedQuestions.get(questionId) ?? null;
}

function getSession(sessionId: string, userId: string): SessionState {
  const store = createStore();
  const safeSessionId = sessionId || `session-${userId}-default`;
  const existing = store.sessions.get(safeSessionId);
  if (existing) {
    return existing;
  }
  const created: SessionState = {
    userId,
    askedQuestionIds: new Set<string>(),
  };
  store.sessions.set(safeSessionId, created);
  return created;
}

function getAnswers(userId: string): AdaptiveAnswerRecord[] {
  const store = createStore();
  return store.answersByUser.get(userId) ?? [];
}

function pushAnswer(record: AdaptiveAnswerRecord): void {
  const store = createStore();
  const answers = store.answersByUser.get(record.userId) ?? [];
  answers.push(record);
  store.answersByUser.set(record.userId, answers);

  const session = getSession(record.sessionId, record.userId);
  session.askedQuestionIds.add(record.questionId);
}

export function estimateAdaptiveAbility(answers: AdaptiveAnswerRecord[]): number {
  if (answers.length === 0) {
    return 0;
  }

  const correctRate = answers.filter((answer) => answer.isCorrect).length / answers.length;
  const avgDifficulty = answers.reduce((sum, answer) => sum + answer.difficulty, 0) / answers.length;
  const avgTime = answers.reduce((sum, answer) => sum + answer.timeSpent, 0) / answers.length;

  const correctnessFactor = (correctRate - 0.5) * 4;
  const difficultyFactor = (avgDifficulty - 0.5) * 2;
  const efficiencyFactor = clamp((75 - avgTime) / 100, -0.5, 0.5);

  return clamp(correctnessFactor + difficultyFactor + efficiencyFactor, -3, 3);
}

export function estimateAdaptiveConfidence(answers: AdaptiveAnswerRecord[], theta: number): [number, number] {
  const width = clamp(1 / Math.sqrt(Math.max(answers.length, 1)), 0.18, 1.2);
  return [Number((theta - width).toFixed(2)), Number((theta + width).toFixed(2))];
}

function tagStats(answers: AdaptiveAnswerRecord[]) {
  const byTag = new Map<string, { total: number; correct: number }>();
  for (const answer of answers) {
    for (const tag of answer.knowledgeTags) {
      const current = byTag.get(tag) ?? { total: 0, correct: 0 };
      current.total += 1;
      if (answer.isCorrect) {
        current.correct += 1;
      }
      byTag.set(tag, current);
    }
  }
  return byTag;
}

function classifyDimensions(answers: AdaptiveAnswerRecord[]) {
  if (answers.length === 0) {
    return {
      computational: 55,
      crossDomain: 50,
      design: 50,
    };
  }

  const questionMap = new Map<string, CrossDomainQuestion>();
  for (const question of PRESET_QUESTIONS) {
    questionMap.set(question.id, question);
  }

  const counters = {
    computational: { total: 0, correct: 0 },
    crossDomain: { total: 0, correct: 0 },
    design: { total: 0, correct: 0 },
  };

  for (const answer of answers) {
    const question = questionMap.get(answer.questionId) ?? getAdaptiveQuestionById(answer.questionId);
    const domains = answer.domains ?? question?.domains;
    const questionType = answer.questionType ?? question?.type;
    if (!domains || !questionType) {
      continue;
    }

    const isCross = domains.length >= 2;
    const isDesign = questionType === 'design-tradeoff' || questionType === 'multi-criteria';
    const isComputational = questionType === 'pole-to-behavior' || questionType === 'bode-to-stability';

    if (isComputational) {
      counters.computational.total += 1;
      if (answer.isCorrect) counters.computational.correct += 1;
    }

    if (isCross) {
      counters.crossDomain.total += 1;
      if (answer.isCorrect) counters.crossDomain.correct += 1;
    }

    if (isDesign) {
      counters.design.total += 1;
      if (answer.isCorrect) counters.design.correct += 1;
    }
  }

  const compute = (bucket: { total: number; correct: number }, defaultScore: number) => {
    if (bucket.total === 0) {
      return defaultScore;
    }
    return Math.round((bucket.correct / bucket.total) * 100);
  };

  return {
    computational: compute(counters.computational, 55),
    crossDomain: compute(counters.crossDomain, 50),
    design: compute(counters.design, 50),
  };
}

export function buildAdaptiveWeakAreas(answers: AdaptiveAnswerRecord[]): string[] {
  if (answers.length === 0) {
    return ['phase-margin', 'disturbance-rejection'];
  }

  const stats = tagStats(answers);
  const sorted = Array.from(stats.entries())
    .map(([tag, bucket]) => ({
      tag,
      accuracy: bucket.correct / Math.max(bucket.total, 1),
      total: bucket.total,
    }))
    .filter((item) => item.total >= 2)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 4)
    .map((item) => item.tag);

  return sorted.length > 0 ? sorted : ['controller-tuning', 'robustness'];
}

export function pickAdaptiveRecommendedFocus(weakAreas: string[]): string[] {
  const mapping: Record<string, string> = {
    'phase-margin': '优先练习“相位裕度-超调量”映射题',
    'disturbance-rejection': '补强扰动抑制与鲁棒性分析',
    'controller-tuning': '加强 PID 参数因果调节训练',
    robustness: '增加参数摄动场景下的决策练习',
    'comfort-constraint': '关注舒适度约束与控制带宽权衡',
  };

  return weakAreas.slice(0, 3).map((tag) => mapping[tag] ?? `围绕 ${tag} 继续练习跨域题目`);
}

function allQuestions(): CrossDomainQuestion[] {
  const store = createStore();
  return [...PRESET_QUESTIONS, ...Array.from(store.generatedQuestions.values())];
}

export function getDiagnostic(userId: string): DiagnosticResult {
  const answers = getAnswers(userId);
  return getDiagnosticFromAnswers(answers);
}

export function getDiagnosticFromAnswers(answers: AdaptiveAnswerRecord[]): DiagnosticResult {
  const knowledgeDimensions = classifyDimensions(answers);
  const weakAreas = buildAdaptiveWeakAreas(answers);
  const recommendedFocus = pickAdaptiveRecommendedFocus(weakAreas);

  return {
    knowledgeDimensions,
    weakAreas,
    recommendedFocus,
  };
}

export function selectNextQuestion(params: {
  userId: string;
  sessionId: string;
  goalId?: string | null;
}): {
  question: PublicQuestion;
  estimatedAbility: number;
  confidenceInterval: [number, number];
} {
  const answers = getAnswers(params.userId);
  const session = getSession(params.sessionId, params.userId);
  const result = selectNextQuestionFromAnswers(params, answers, session.askedQuestionIds);
  session.askedQuestionIds.add(result.question.id);
  return result;
}

export function selectNextQuestionFromAnswers(
  params: {
    userId: string;
    sessionId: string;
    goalId?: string | null;
  },
  answers: AdaptiveAnswerRecord[],
  askedQuestionIds = new Set(
    answers
      .filter((answer) => answer.sessionId === params.sessionId)
      .map((answer) => answer.questionId),
  ),
): {
  question: PublicQuestion;
  estimatedAbility: number;
  confidenceInterval: [number, number];
} {
  const theta = estimateAdaptiveAbility(answers);
  const confidenceInterval = estimateAdaptiveConfidence(answers, theta);
  const weakAreas = new Set(buildAdaptiveWeakAreas(answers));
  const targetDifficulty = clamp((theta + 3) / 6, 0, 1);

  const targetGoalId = typeof params.goalId === 'string' && params.goalId.trim().length > 0
    ? params.goalId.trim()
    : null;
  const candidates = filterQuestionsByGoal(allQuestions(), targetGoalId);
  const unaskedCandidates = candidates.filter((question) => !askedQuestionIds.has(question.id));
  if (targetGoalId && unaskedCandidates.length === 0) {
    throw new Error(`学习目标 ${targetGoalId} 的已审核 readiness 题目已完成`);
  }
  const selectionPool = unaskedCandidates.length > 0 ? unaskedCandidates : candidates;
  const scored = selectionPool.map((question) => {
    const closeness = 1 - Math.abs(question.difficulty - targetDifficulty);
    const weakBoost = question.knowledgeTags.reduce((sum, tag) => sum + (weakAreas.has(tag) ? 0.15 : 0), 0);
    const score = closeness + weakBoost;

    return {
      question,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const selected = scored[0]?.question ?? PRESET_QUESTIONS[0];

  return {
    question: toPublicQuestion(selected),
    estimatedAbility: Number(theta.toFixed(2)),
    confidenceInterval,
  };
}

function filterQuestionsByGoal(questions: CrossDomainQuestion[], targetGoalId?: string | null): CrossDomainQuestion[] {
  if (!targetGoalId) return questions;
  const scopedQuestions = questions.filter((question) => {
    const metadata = buildKaqQuizQuestionMetadata(question);
    return metadata.learningGoalIds.includes(targetGoalId) &&
      metadata.review.state === 'reviewed' &&
      metadata.purpose === 'readiness-gate';
  });
  if (scopedQuestions.length === 0) {
    throw new Error(`未找到学习目标 ${targetGoalId} 的已审核 readiness 题目`);
  }
  return scopedQuestions;
}

export function generateQuestion(params: {
  targetKnowledgeTags: string[];
  difficultyTarget: number;
  domains: QuestionDomain[];
}) {
  const tags = params.targetKnowledgeTags.length > 0 ? params.targetKnowledgeTags : ['controller-tuning', 'robustness'];
  const domains: QuestionDomain[] = params.domains.length > 0 ? params.domains : ['time', 'frequency'];
  const difficulty = clamp(params.difficultyTarget, 0.1, 1);

  const id = `generated-q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const stem = `请完成一道跨域控制设计题：已知系统在 ${domains.join(' / ')} 域表现不一致，请针对知识点 ${tags.join('、')} 设计可执行调参策略，并说明约束。`;

  const question = buildGeneratedQuestion(id, stem, difficulty, domains, tags);
  const store = createStore();
  store.generatedQuestions.set(question.id, question);

  return toPublicQuestion(question);
}

const OPTION_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function optionKeyAt(index: number): string {
  return OPTION_KEYS[index] ?? `OPTION_${index + 1}`;
}

function findSelectedOption(question: CrossDomainQuestion, selectedOption: string) {
  const optionIndex = question.options.findIndex(
    (option) => option.label === selectedOption || option.text === selectedOption,
  );

  return {
    option: optionIndex >= 0 ? question.options[optionIndex] : undefined,
    optionKey: optionIndex >= 0 ? optionKeyAt(optionIndex) : 'UNKNOWN',
  };
}

function findCorrectOption(question: CrossDomainQuestion) {
  const optionIndex = question.options.findIndex((option) => option.isCorrect);

  return {
    option: optionIndex >= 0 ? question.options[optionIndex] : undefined,
    optionKey: optionIndex >= 0 ? optionKeyAt(optionIndex) : 'UNKNOWN',
  };
}

export function submitAnswerWithDetails(params: SubmitAnswerParams): SubmittedAnswerDetails {
  const question = getAdaptiveQuestionById(params.questionId);
  if (!question) {
    throw new Error('题目不存在');
  }

  const selected = findSelectedOption(question, params.selectedOption);
  const correct = findCorrectOption(question);
  const answer = selected.option;
  const isCorrect = Boolean(answer?.isCorrect);
  const record: AdaptiveAnswerRecord = {
    sessionId: params.sessionId,
    userId: params.userId,
    questionId: question.id,
    isCorrect,
    timeSpent: Math.max(1, Math.round(params.timeSpent || 1)),
    selectedOption: params.selectedOption,
    difficulty: question.difficulty,
    knowledgeTags: question.knowledgeTags,
    questionType: question.type,
    domains: question.domains,
    createdAt: Date.now(),
  };

  pushAnswer(record);

  const answers = getAnswers(params.userId);
  const details = {
    result: {
      isCorrect,
      correctOption: correct.option?.label ?? '',
      explanation: answer?.explanation ?? '请关注题干中的“域间映射”和“约束优先级”。',
      estimatedAbility: 0,
      recommendedFocus: [],
    },
    record,
    question,
    selectedOptionKey: selected.optionKey,
    correctOptionKey: correct.optionKey,
    pathContext: params.pathContext,
  };

  return {
    ...details,
    result: buildSubmitAnswerResult(details, answers),
  };
}

export function buildSubmitAnswerResult(
  details: Omit<SubmittedAnswerDetails, 'result'>,
  answers: AdaptiveAnswerRecord[],
): SubmitAnswerResult {
  const answer = details.question.options.find(
    (option) => option.label === details.record.selectedOption || option.text === details.record.selectedOption,
  );
  const correct = findCorrectOption(details.question);
  const theta = estimateAdaptiveAbility(answers);

  return {
    isCorrect: details.record.isCorrect,
    correctOption: correct.option?.label ?? '',
    explanation: answer?.explanation ?? '请关注题干中的“域间映射”和“约束优先级”。',
    estimatedAbility: Number(theta.toFixed(2)),
    recommendedFocus: pickAdaptiveRecommendedFocus(buildAdaptiveWeakAreas(answers)),
  };
}

export function createSubmitAnswerDetails(params: SubmitAnswerParams): SubmittedAnswerDetails {
  const question = getAdaptiveQuestionById(params.questionId);
  if (!question) {
    throw new Error('题目不存在');
  }

  const selected = findSelectedOption(question, params.selectedOption);
  const correct = findCorrectOption(question);
  const answer = selected.option;
  const isCorrect = Boolean(answer?.isCorrect);
  const record: AdaptiveAnswerRecord = {
    sessionId: params.sessionId,
    userId: params.userId,
    questionId: question.id,
    isCorrect,
    timeSpent: Math.max(1, Math.round(params.timeSpent || 1)),
    selectedOption: params.selectedOption,
    difficulty: question.difficulty,
    knowledgeTags: question.knowledgeTags,
    questionType: question.type,
    domains: question.domains,
    createdAt: Date.now(),
  };
  const details = {
    result: {
      isCorrect,
      correctOption: correct.option?.label ?? '',
      explanation: answer?.explanation ?? '请关注题干中的“域间映射”和“约束优先级”。',
      estimatedAbility: 0,
      recommendedFocus: [],
    },
    record,
    question,
    selectedOptionKey: selected.optionKey,
    correctOptionKey: correct.optionKey,
    pathContext: params.pathContext,
  };

  return {
    ...details,
    result: buildSubmitAnswerResult(details, [record]),
  };
}

export function submitAnswer(params: SubmitAnswerParams): SubmitAnswerResult {
  return submitAnswerWithDetails(params).result;
}

export function getAbilityReport(userId: string): AbilityReport {
  const answers = getAnswers(userId);
  return getAbilityReportFromAnswers(userId, answers);
}

export function getAbilityReportFromAnswers(userId: string, answers: AdaptiveAnswerRecord[]): AbilityReport {
  const theta = estimateAdaptiveAbility(answers);
  const confidenceInterval = estimateAdaptiveConfidence(answers, theta);

  const timeline: Array<{ timestamp: number; theta: number; accuracy: number }> = [];
  let correct = 0;

  for (let i = 0; i < answers.length; i += 1) {
    const slice = answers.slice(0, i + 1);
    if (answers[i].isCorrect) {
      correct += 1;
    }
    timeline.push({
      timestamp: answers[i].createdAt,
      theta: Number(estimateAdaptiveAbility(slice).toFixed(2)),
      accuracy: Number((correct / (i + 1)).toFixed(2)),
    });
  }

  const dimensionsRaw = classifyDimensions(answers);
  const dimensions = {
    computationalTheta: Number((((dimensionsRaw.computational - 50) / 50) * 1.8).toFixed(2)),
    crossDomainTheta: Number((((dimensionsRaw.crossDomain - 50) / 50) * 1.8).toFixed(2)),
    designTheta: Number((((dimensionsRaw.design - 50) / 50) * 1.8).toFixed(2)),
  };

  return {
    userId,
    estimatedAbility: Number(theta.toFixed(2)),
    confidenceInterval,
    timeline,
    dimensions,
  };
}
