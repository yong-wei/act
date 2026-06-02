import { generateText } from 'ai';

import { getConfiguredAIModel, isConfiguredAIServiceAvailable } from '@/lib/ai-client';
import {
  COMPETENCY_DIMENSIONS,
  getCompetencyLabel,
  type CompetencyVector,
} from './competency-model';

type GrowthRecordDelegate = {
  findFirst(args: {
    where: { userId: string; recordType: string; courseId: string };
    orderBy?: { occurredAt: 'desc' };
  }): Promise<{ id: string; evidenceJson: unknown } | null>;
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
};

type UserDelegate = {
  findUnique(args: {
    where: { id: string };
    select: { name: true; profile: { select: { studentNumber: true } } };
  }): Promise<{ name: string | null; profile: { studentNumber: string | null } | null } | null>;
};

export interface GrowthEvaluationSnapshot {
  id: string;
  userId: string;
  snapshotAt: Date;
  factCount: number;
  competencyVector: unknown;
  evidenceSummary: unknown;
}

export interface GrowthEvaluationDb {
  user: UserDelegate;
  growthRecord: GrowthRecordDelegate;
}

export type QualitativeTextGenerator = (prompt: string) => Promise<string>;

const RECORD_TYPE = 'competency_evaluation';
const RECORD_COURSE_ID = 'profile:growth-evaluation';
const DEFAULT_LLM_TIMEOUT_MS = 15_000;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readSnapshotAt(value: unknown): string | null {
  const record = asRecord(value);
  return typeof record.snapshotAt === 'string' ? record.snapshotAt : null;
}

function toVector(value: unknown): CompetencyVector {
  return value as CompetencyVector;
}

function strongestAndWeakest(vector: CompetencyVector) {
  const ranked = COMPETENCY_DIMENSIONS
    .map((dimension) => ({
      dimension,
      label: getCompetencyLabel(dimension),
      score: vector[dimension]?.score ?? 0,
      evidenceCount: vector[dimension]?.evidenceCount ?? 0,
    }))
    .sort((a, b) => b.score - a.score);
  const coveredRanked = ranked.filter((item) => item.evidenceCount > 0);
  const uncovered = ranked.filter((item) => item.evidenceCount === 0);
  const weakestCandidates = coveredRanked.length > 0 ? coveredRanked : ranked;

  return {
    strongest: coveredRanked[0] ?? ranked[0],
    weakest: weakestCandidates[weakestCandidates.length - 1],
    ranked,
    coveredRanked,
    uncovered,
  };
}

function compactEvidence(evidenceSummary: unknown) {
  const summary = asRecord(evidenceSummary);
  return COMPETENCY_DIMENSIONS.flatMap((dimension) => {
    const items = Array.isArray(summary[dimension]) ? summary[dimension] as Array<Record<string, unknown>> : [];
    return items.slice(0, 2).map((item) => ({
      dimension: getCompetencyLabel(dimension),
      title: typeof item.evidenceTitle === 'string' ? item.evidenceTitle : `${item.factType ?? '学习证据'}`,
      outcome: typeof item.outcome === 'string' ? item.outcome : 'unknown',
      score: typeof item.score === 'number' ? item.score : null,
    }));
  }).slice(0, 6);
}

export function buildGrowthEvaluationPrompt(input: {
  studentName: string;
  studentNumber?: string | null;
  snapshot: GrowthEvaluationSnapshot;
}): string {
  const vector = toVector(input.snapshot.competencyVector);
  const { strongest, weakest, ranked, uncovered } = strongestAndWeakest(vector);
  const evidence = compactEvidence(input.snapshot.evidenceSummary);

  return [
    '你是自动控制原理课程的学习评价助教。请基于平台学习数据，为学生生成一段个性化成长档案定性评价。',
    '要求：中文，80字以内；必须指出一个已表现出的能力证据、一个最需要改进的方向、一个具体下一步行动；不要使用空泛鼓励语。',
    '重要规则：证据数为0的维度只是未采集或未覆盖，不能写成能力薄弱、缺乏、需要补强；改进方向只能来自已有证据维度中的相对低分项。',
    `学生：${input.studentName}${input.studentNumber ? `（${input.studentNumber}）` : ''}`,
    `事实数量：${input.snapshot.factCount}`,
    `能力得分：${ranked.map((item) => `${item.label}${Math.round(item.score)}分/证据${item.evidenceCount}条`).join('；')}`,
    `相对优势：${strongest.label}`,
    `优先补强：${weakest.label}`,
    `未覆盖维度：${uncovered.map((item) => item.label).join('；') || '无'}`,
    `主要证据：${evidence.map((item) => `${item.dimension}-${item.title}-${item.outcome}${item.score === null ? '' : `-${item.score}分`}`).join('；') || '暂无可读证据'}`,
  ].join('\n');
}

export function buildFallbackGrowthEvaluation(input: {
  studentName: string;
  snapshot: GrowthEvaluationSnapshot;
}) {
  const vector = toVector(input.snapshot.competencyVector);
  const { strongest, weakest } = strongestAndWeakest(vector);
  return `${input.studentName}当前在${strongest.label}上证据较多，${weakest.label}的已有证据相对较弱。下一步应选择一条课堂证据，写清判断依据和改进动作。`;
}

async function generateWithConfiguredModel(prompt: string) {
  if (!(await isConfiguredAIServiceAvailable())) {
    return null;
  }

  const timeoutMs = Number.parseInt(
    process.env.GROWTH_EVALUATION_LLM_TIMEOUT_MS || `${DEFAULT_LLM_TIMEOUT_MS}`,
    10,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_LLM_TIMEOUT_MS);

  try {
    const result = await generateText({
      model: await getConfiguredAIModel(),
      prompt,
      temperature: 0.2,
      maxOutputTokens: 220,
      abortSignal: controller.signal,
    });

    return result.text.trim();
  } catch (error) {
    if (controller.signal.aborted) {
      console.error('[GrowthEvaluation] qualitative generation timed out, using fallback');
      return null;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function refreshStudentGrowthEvaluation(
  db: GrowthEvaluationDb,
  input: {
    snapshot: GrowthEvaluationSnapshot;
    generateQualitativeText?: QualitativeTextGenerator;
  },
) {
  if (input.snapshot.factCount <= 0) {
    return { action: 'skipped_no_evidence' as const, description: null };
  }

  const existing = await db.growthRecord.findFirst({
    where: {
      userId: input.snapshot.userId,
      recordType: RECORD_TYPE,
      courseId: RECORD_COURSE_ID,
    },
    orderBy: { occurredAt: 'desc' },
  });
  const existingSnapshotAt = readSnapshotAt(existing?.evidenceJson);
  if (existingSnapshotAt && new Date(existingSnapshotAt).getTime() >= input.snapshot.snapshotAt.getTime()) {
    return { action: 'skipped' as const, description: null };
  }

  const user = await db.user.findUnique({
    where: { id: input.snapshot.userId },
    select: { name: true, profile: { select: { studentNumber: true } } },
  });
  const studentName = user?.name?.trim() || '该学生';
  const prompt = buildGrowthEvaluationPrompt({
    studentName,
    studentNumber: user?.profile?.studentNumber,
    snapshot: input.snapshot,
  });
  let generated: string | null = null;
  try {
    generated = input.generateQualitativeText
      ? await input.generateQualitativeText(prompt)
      : await generateWithConfiguredModel(prompt);
  } catch (error) {
    console.error('[GrowthEvaluation] qualitative generation failed, using fallback', error);
  }
  const description = (generated?.trim() || buildFallbackGrowthEvaluation({ studentName, snapshot: input.snapshot })).slice(0, 240);
  const snapshotAt = input.snapshot.snapshotAt.toISOString();
  const evidenceJson = {
    source: generated ? 'llm' : 'fallback',
    snapshotId: input.snapshot.id,
    snapshotAt,
    factCount: input.snapshot.factCount,
    prompt,
  };

  const data = {
    userId: input.snapshot.userId,
    recordType: RECORD_TYPE,
    title: '阶段性能力画像评价',
    description,
    evidenceJson,
    mediaUrls: [],
    occurredAt: input.snapshot.snapshotAt,
    courseId: RECORD_COURSE_ID,
    isPublic: false,
  };

  if (existing) {
    await db.growthRecord.update({
      where: { id: existing.id },
      data,
    });
    return { action: 'updated' as const, description };
  }

  await db.growthRecord.create({ data });
  return { action: 'created' as const, description };
}
