import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import { formatArenaMetric } from '../display-labels';

export type ArenaKonlingSuggestionKind = 'stagnation' | 'continuous-failure' | 'constraint-violation';

export interface ArenaKonlingSuggestion {
  kind: ArenaKonlingSuggestionKind;
  title: string;
  evidence: string[];
  nextStep: string;
  baselineSubmissionId?: string;
  revisit?: string;
}

interface StoredSuggestion {
  id: string;
  evidence: unknown;
  outcome?: unknown;
  createdAt: Date;
}

export interface ArenaKonlingFollowupDb {
  aIIntervention: {
    findFirst(args: unknown): Promise<StoredSuggestion | null>;
    create(args: unknown): Promise<{ id: string }>;
    updateMany?(args: unknown): Promise<{ count: number }>;
  };
}

export async function createArenaOfficialKonlingFollowup(input: {
  db: ArenaKonlingFollowupDb;
  submission: ArenaSubmissionRecord;
  history: readonly ArenaSubmissionRecord[];
}): Promise<{ id: string; suggestion: ArenaKonlingSuggestion; classId?: string } | null> {
  const suggestion = buildArenaOfficialKonlingSuggestion(input.submission, input.history);
  if (!suggestion) return null;

  const sessionId = suggestionSessionId(input.submission);
  const existing = await input.db.aIIntervention.findFirst({
    where: { userId: input.submission.userId, sessionId },
    select: { id: true, evidence: true, createdAt: true },
  });
  if (existing) return { id: existing.id, suggestion, classId: input.submission.classId };

  let created: { id: string };
  try {
    created = await input.db.aIIntervention.create({
    data: {
      userId: input.submission.userId,
      sessionId,
      classId: input.submission.classId ?? null,
      triggerType: `arena-official:${suggestion.kind}`,
      interventionType: 'guidance',
      content: suggestion.nextStep,
      whyNow: suggestion.title,
      evidence: {
        sourceSubmissionId: input.submission.id,
        taskId: input.submission.taskId,
        sourceSubmission: {
          score: input.submission.evaluation.score,
          metrics: input.submission.evaluation.metrics,
          hardConstraintResults: input.submission.evaluation.hardConstraintResults,
        },
        suggestion,
      },
      alternatives: [],
      privacyScope: 'student-visible',
      teacherPolicy: 'allowed',
    },
    select: { id: true },
    });
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') throw error;
    const concurrent = await input.db.aIIntervention.findFirst({
      where: { userId: input.submission.userId, sessionId },
      select: { id: true, evidence: true, createdAt: true },
    });
    if (!concurrent) throw error;
    return { id: concurrent.id, suggestion, classId: input.submission.classId };
  }
  return { id: created.id, suggestion, classId: input.submission.classId };
}

export async function readArenaOfficialRevisit(input: {
  db: ArenaKonlingFollowupDb;
  submission: ArenaSubmissionRecord;
}): Promise<string | null> {
  const previous = await input.db.aIIntervention.findFirst({
    where: {
      userId: input.submission.userId,
      classId: input.submission.classId ?? null,
      sessionId: { startsWith: `arena-official:${input.submission.taskId}:` },
      outcome: null,
      createdAt: { lt: new Date(input.submission.submittedAt) },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, evidence: true, createdAt: true },
  });
  const baseline = baselineFromEvidence(previous?.evidence);
  if (!baseline) return null;

  await input.db.aIIntervention.updateMany?.({
    where: { id: previous?.id, outcome: null },
    data: { outcome: { status: 'revisited', revisitedBySubmissionId: input.submission.id } },
  });

  const currentFailures = failureLabels(input.submission);
  const status = currentFailures.length === 0 ? '本次正式评测的硬约束均已通过。' : `本次仍未通过：${currentFailures.join('、')}。`;
  const scoreDelta = round(input.submission.evaluation.score - baseline.score);
  const metricDeltas = Object.keys(input.submission.evaluation.metrics)
    .map((metricId) => {
      const before = baseline.metrics[metricId];
      const after = input.submission.evaluation.metrics[metricId];
      return typeof before === 'number' && typeof after === 'number'
        ? `${formatArenaMetric(metricId)} ${formatDelta(round(after - before))}`
        : null;
    })
    .filter((value): value is string => Boolean(value));
  const constraintChanges = constraintChangeLabels(baseline.hardConstraintResults, input.submission);
  return `与建议触发时的正式评测相比，得分变化 ${formatDelta(scoreDelta)}；指标变化：${metricDeltas.join('、') || '暂无可比指标'}；硬约束变化：${constraintChanges.join('、') || '无变化'}；${status}`;
}

export function buildArenaOfficialKonlingSuggestion(
  submission: ArenaSubmissionRecord,
  history: readonly ArenaSubmissionRecord[],
): ArenaKonlingSuggestion | null {
  const attempts = history
    .filter((item) => item.userId === submission.userId && item.taskId === submission.taskId && item.classId === submission.classId)
    .sort((left, right) => Date.parse(left.submittedAt) - Date.parse(right.submittedAt));
  const currentIndex = attempts.findIndex((item) => item.id === submission.id);
  const currentAndPrevious = currentIndex >= 0 ? attempts.slice(0, currentIndex + 1) : [...attempts, submission];
  const recent = currentAndPrevious.slice(-3);
  const failures = failureLabels(submission);

  if (recent.length === 3 && recent.every((item) => !item.evaluation.valid) &&
    recent.every((item) => failureSignature(item) === failureSignature(recent[0]!)) &&
    parameterChangeCount(recent) >= 2) {
    return {
      kind: 'stagnation',
      title: '连续三次改参后未通过同一组硬约束',
      evidence: [
        `未通过约束：${failures.join('、') || '当前任务约束'}`,
        `最近三次正式评测得分：${recent.map((item) => round(item.evaluation.score)).join('、')}`,
      ],
      nextStep: '先固定其余参数，仅围绕一项与未通过约束直接相关的参数做小幅调整，再提交正式评测验证。',
      baselineSubmissionId: submission.id,
    };
  }

  if (currentAndPrevious.slice(-2).length === 2 && currentAndPrevious.slice(-2).every((item) => !item.evaluation.valid)) {
    return {
      kind: 'continuous-failure',
      title: '同一任务连续两次未达标',
      evidence: [
        `当前未通过约束：${failures.join('、') || '当前任务约束'}`,
        `本次正式评测得分：${round(submission.evaluation.score)}`,
      ],
      nextStep: '先逐项复核当前未通过约束的原因，再选择一项参数调整并重新提交正式评测。',
      baselineSubmissionId: submission.id,
    };
  }

  if (failures.length > 0) {
    return {
      kind: 'constraint-violation',
      title: '本次正式评测存在硬约束违规',
      evidence: failureEvidence(submission),
      nextStep: '先使当前未通过的硬约束达标，再比较其他性能指标。',
      baselineSubmissionId: submission.id,
    };
  }

  return null;
}

export function suggestionSessionId(submission: ArenaSubmissionRecord): string {
  return `arena-official:${submission.taskId}:${submission.id}`;
}

function failureLabels(submission: ArenaSubmissionRecord): string[] {
  return submission.evaluation.hardConstraintResults
    .filter((result) => !result.passed)
    .map((result) => result.label);
}

function failureEvidence(submission: ArenaSubmissionRecord): string[] {
  return submission.evaluation.hardConstraintResults
    .filter((result) => !result.passed)
    .map((result) => result.reason ? `${result.label}：${result.reason}` : result.label);
}

function failureSignature(submission: ArenaSubmissionRecord): string {
  return failureLabels(submission).sort().join('|');
}

function parameterChangeCount(submissions: readonly ArenaSubmissionRecord[]): number {
  let changes = 0;
  for (let index = 1; index < submissions.length; index += 1) {
    if (JSON.stringify(submissions[index - 1]?.artifact.params) !== JSON.stringify(submissions[index]?.artifact.params)) {
      changes += 1;
    }
  }
  return changes;
}

function baselineFromEvidence(value: unknown): { score: number; metrics: Record<string, number>; hardConstraintResults: ArenaSubmissionRecord['evaluation']['hardConstraintResults'] } | null {
  if (!value || typeof value !== 'object') return null;
  const source = (value as Record<string, unknown>).sourceSubmission as Record<string, unknown> | undefined;
  return source && typeof source.score === 'number'
    ? {
      score: source.score,
      metrics: (source.metrics as Record<string, number> | undefined) ?? {},
      hardConstraintResults: (source.hardConstraintResults as ArenaSubmissionRecord['evaluation']['hardConstraintResults'] | undefined) ?? [],
    }
    : null;
}

function formatDelta(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

function constraintChangeLabels(
  before: ArenaSubmissionRecord['evaluation']['hardConstraintResults'],
  submission: ArenaSubmissionRecord,
): string[] {
  const current = new Map(submission.evaluation.hardConstraintResults.map((item) => [item.label, item.passed]));
  return before.map((item) => {
    const after = current.get(item.label);
    return typeof after === 'boolean' && after !== item.passed
      ? `${item.label} ${item.passed ? '通过→未通过' : '未通过→通过'}`
      : null;
  }).filter((value): value is string => Boolean(value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
