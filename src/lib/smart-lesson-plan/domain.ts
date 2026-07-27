import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

import {
  bopppsStageSchema,
  smartLessonOutlineOutputSchema,
  sourceBindingSchema,
  sourceStateSchema,
  type SmartLessonPlan,
} from './schema';

export type SmartLessonActor = { id: string; role: 'TEACHER' | 'ADMIN' };
export type SmartLessonSourceState = z.infer<typeof sourceStateSchema>;
export type SmartLessonSourceBinding = z.infer<typeof sourceBindingSchema>;

export class SmartLessonPlanError extends Error {
  constructor(public readonly code: string, public readonly status = 400) {
    super(code);
    this.name = 'SmartLessonPlanError';
  }
}

const aggregateClassContextBaseSchema = z.object({
  classId: z.string().trim().min(1).max(200),
  asOf: z.string().datetime().nullable(),
  contextRef: z.string().trim().min(1).max(200),
});

const availableAggregateClassContextSchema = aggregateClassContextBaseSchema.extend({
  cohortBucket: z.enum(['5-9', '10-19', '20-plus']),
  overall: z.object({
    attainment: z.number().min(0).max(1).nullable(),
    coverage: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1).nullable(),
  }).strict(),
  competencies: z.array(z.object({
    identity: z.string().trim().min(1).max(100),
    attainment: z.number().min(0).max(1).nullable(),
    coverage: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1).nullable(),
  }).strict()).max(50),
  gaps: z.array(z.object({
    identity: z.string().trim().min(1).max(100),
    reason: z.enum(['improvement-cluster']),
  }).strict()).max(50),
}).strict();

const suppressedAggregateClassContextSchema = aggregateClassContextBaseSchema.extend({
  cohortBucket: z.literal('suppressed-small'),
  suppressionReason: z.literal('cohort-below-five'),
}).strict();

const unavailableAggregateClassContextSchema = aggregateClassContextBaseSchema.extend({
  cohortBucket: z.literal('none'),
  unavailableReason: z.literal('no-active-learners'),
}).strict();

export const aggregateClassContextSchema = z.union([
  availableAggregateClassContextSchema,
  suppressedAggregateClassContextSchema,
  unavailableAggregateClassContextSchema,
]);

export const aggregateClassContextRefSchema = z.object({
  classId: z.string().trim().min(1).max(200),
}).strict();

export type AggregateClassContext = z.infer<typeof aggregateClassContextSchema>;
export type AggregateClassContextRef = z.infer<typeof aggregateClassContextRefSchema>;

export function assertSingleLessonDuration(durationMinutes: number): number {
  if (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > 120 || durationMinutes % 5 !== 0) {
    throw new SmartLessonPlanError('duration-invalid');
  }
  return durationMinutes;
}

export function projectAggregateClassContext(value: unknown): AggregateClassContext | null {
  if (value === null || value === undefined) return null;
  const parsed = aggregateClassContextSchema.safeParse(value);
  if (!parsed.success) throw new SmartLessonPlanError('aggregate-class-context-invalid');
  return parsed.data;
}

export function projectCurrentCumulativeClassPortrait(input: {
  classId: string;
  portrait: unknown;
}): AggregateClassContext {
  const portrait = z.object({
    stateKind: z.literal('SNAPSHOT'),
    evidenceAsOf: z.string().datetime().nullable(),
    generatedAt: z.string().datetime().nullable(),
    activeStudentCount: z.number().int().nonnegative(),
    totalStudentCount: z.number().int().nonnegative(),
    aggregate: z.object({
      overall: z.object({
        mean: z.number().min(0).max(1).nullable(),
        meanConfidence: z.number().min(0).max(1).nullable(),
        includedCount: z.number().int().nonnegative(),
        missingCount: z.number().int().nonnegative(),
      }).passthrough(),
      dimensions: z.record(z.string(), z.object({
        mean: z.number().min(0).max(1).nullable(),
        meanConfidence: z.number().min(0).max(1).nullable(),
        includedCount: z.number().int().nonnegative(),
        missingCount: z.number().int().nonnegative(),
      }).passthrough()),
    }).passthrough(),
    diagnosis: z.object({
      improvementClusters: z.array(z.string().trim().min(1).max(100)).max(50),
    }).passthrough(),
  }).passthrough().safeParse(input.portrait);
  if (!portrait.success) throw new SmartLessonPlanError('aggregate-class-context-invalid');
  const total = portrait.data.totalStudentCount;
  const bucket = cohortBucket(total);
  const suppressed = {
    classId: input.classId,
    asOf: portrait.data.evidenceAsOf ?? portrait.data.generatedAt,
    cohortBucket: bucket,
    ...(bucket === 'none'
      ? { unavailableReason: 'no-active-learners' as const }
      : { suppressionReason: 'cohort-below-five' as const }),
  };
  if (total < 5) {
    return aggregateClassContextSchema.parse({
      ...suppressed,
      contextRef: `cumulative-class-portrait:${contentHash(suppressed)}`,
    });
  }
  const coverage = (included: number, missing: number) => included + missing > 0
    ? included / (included + missing)
    : 0;
  const projected = {
    classId: input.classId,
    asOf: portrait.data.evidenceAsOf ?? portrait.data.generatedAt,
    cohortBucket: bucket,
    overall: {
      attainment: portrait.data.aggregate.overall.mean,
      coverage: coverage(
        portrait.data.aggregate.overall.includedCount,
        portrait.data.aggregate.overall.missingCount,
      ),
      confidence: portrait.data.aggregate.overall.meanConfidence,
    },
    competencies: Object.entries(portrait.data.aggregate.dimensions)
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, 50)
      .map(([identity, dimension]) => ({
        identity,
        attainment: dimension.mean,
        coverage: coverage(dimension.includedCount, dimension.missingCount),
        confidence: dimension.meanConfidence,
      })),
    gaps: [...new Set(portrait.data.diagnosis.improvementClusters)]
      .sort()
      .map((identity) => ({ identity, reason: 'improvement-cluster' as const })),
  };
  return aggregateClassContextSchema.parse({
    ...projected,
    contextRef: `cumulative-class-portrait:${contentHash(projected)}`,
  });
}

function cohortBucket(total: number): 'none' | 'suppressed-small' | '5-9' | '10-19' | '20-plus' {
  if (total === 0) return 'none';
  if (total < 5) return 'suppressed-small';
  if (total < 10) return '5-9';
  if (total < 20) return '10-19';
  return '20-plus';
}

export function normalizeSourceMatchingMeaning(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/[\p{P}\p{S}\s]+/gu, '')
    .trim();
}

export function shouldMarkClassContextStale(input: {
  previousClassId: string | null;
  nextClassId: string | null;
  hasGeneratedContent: boolean;
  staleAt: Date | null;
}) {
  return input.previousClassId !== input.nextClassId
    && input.hasGeneratedContent
    && input.staleAt === null;
}

export function sourceGapDecisionComplete(input: {
  sourceState: string;
  gapReason: string | null;
  sourceBindings?: unknown;
}) {
  if (input.sourceState === 'VERIFIED') return true;
  return input.sourceState === 'NO_RELIABLE_SOURCE'
    && Array.isArray(input.sourceBindings)
    && input.sourceBindings.length === 0
    && Boolean(input.gapReason?.trim());
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function contentHash(value: unknown): string {
  return createHash('sha256').update(typeof value === 'string' ? value.trim() : stableJson(value)).digest('hex');
}

export function smartLessonGenerationInputHash(task: {
  id: string;
  lineageId: string;
  revision: number;
  courseBasisId: string;
  topic: string;
  audience: string;
  prerequisites: string;
  durationMinutes: number;
  outlineConfirmationRequired: boolean;
  scopeConfirmedAt: Date | null;
  goalsConfirmedAt: Date | null;
  selectedClassId?: string | null;
  textbookRanges?: unknown;
  aggregateClassContext: unknown;
  aggregateClassContextRef: string | null;
  sources: Array<{ sourceVersionId: string }>;
  knowledgePoints: Array<{
    id: string; lineageId: string; title: string; contentHash: string; sourceState: string;
    sourceBindings: unknown; sourceBindingSetHash: string; gapIdentity: string | null; gapReason?: string | null;
    origin: string; supersedesIds: string[];
  }>;
  goals: Array<{
    id: string; lineageId: string; content: string; contentHash: string; sourceState: string;
    sourceBindings: unknown; sourceBindingSetHash: string; gapIdentity: string | null; gapReason?: string | null;
    standardsMappings: unknown;
  }>;
}) {
  const byId = <T extends { id: string }>(items: T[]) => [...items].sort((left, right) => left.id.localeCompare(right.id));
  return contentHash({
    taskId: task.id,
    taskLineageId: task.lineageId,
    taskRevision: task.revision,
    courseBasisId: task.courseBasisId,
    topic: task.topic,
    audience: task.audience,
    prerequisites: task.prerequisites,
    durationMinutes: task.durationMinutes,
    outlineConfirmationRequired: task.outlineConfirmationRequired,
    scopeConfirmedAt: task.scopeConfirmedAt?.toISOString() ?? null,
    goalsConfirmedAt: task.goalsConfirmedAt?.toISOString() ?? null,
    selectedClassId: task.selectedClassId ?? null,
    textbookRanges: task.textbookRanges ?? [],
    aggregateClassContext: task.aggregateClassContext,
    aggregateClassContextRef: task.aggregateClassContextRef,
    sourceVersionIds: task.sources.map((source) => source.sourceVersionId).sort(),
    knowledgePoints: byId(task.knowledgePoints).map((point) => ({
      id: point.id,
      lineageId: point.lineageId,
      title: point.title,
      contentHash: point.contentHash,
      sourceState: point.sourceState,
      sourceBindings: point.sourceBindings,
      sourceBindingSetHash: point.sourceBindingSetHash,
      gapIdentity: point.gapIdentity,
      gapReason: point.gapReason ?? null,
      origin: point.origin,
      supersedesIds: [...point.supersedesIds].sort(),
    })),
    goals: byId(task.goals).map((goal) => ({
      id: goal.id,
      lineageId: goal.lineageId,
      content: goal.content,
      contentHash: goal.contentHash,
      sourceState: goal.sourceState,
      sourceBindings: goal.sourceBindings,
      sourceBindingSetHash: goal.sourceBindingSetHash,
      gapIdentity: goal.gapIdentity,
      gapReason: goal.gapReason ?? null,
      standardsMappings: goal.standardsMappings,
    })),
  });
}

export function normalizeSourceBindings(bindings: unknown): SmartLessonSourceBinding[] {
  const parsed = z.array(sourceBindingSchema).max(100).parse(bindings);
  const unique = new Map(parsed.map((binding) => [
    `${binding.sourceVersionId}:${binding.anchor}:${binding.contentHash}:${binding.citationId}`,
    binding,
  ]));
  return [...unique.values()].sort((left, right) => stableJson(left).localeCompare(stableJson(right)));
}

export function canonicalSourceFields(input: {
  itemId: string;
  itemLineageId: string;
  taskLineageId: string;
  content: string;
  sourceState: SmartLessonSourceState;
  sourceBindings: unknown;
}) {
  const sourceState = sourceStateSchema.parse(input.sourceState);
  const sourceBindings = normalizeSourceBindings(input.sourceBindings);
  if (sourceState === 'VERIFIED' && sourceBindings.length === 0) {
    throw new SmartLessonPlanError('verified-source-binding-required');
  }
  const itemContentHash = contentHash(normalizeSourceMatchingMeaning(input.content));
  const sourceBindingSetHash = contentHash(sourceBindings);
  const gapIdentity = sourceState === 'VERIFIED'
    ? null
    : `smart-goal-gap:${contentHash({
      itemId: input.itemId,
      itemLineageId: input.itemLineageId,
      taskLineageId: input.taskLineageId,
      itemContentHash,
      sourceState,
      sourceBindingSetHash,
    })}`;
  return { contentHash: itemContentHash, sourceBindings, sourceBindingSetHash, sourceState, gapIdentity };
}

export function newAggregateIdentity() {
  return randomUUID();
}

export type StructuredProviderCandidate = {
  serviceId: string;
  providerKind: string;
  model: string;
  enabled: boolean;
  priority: number;
  capabilities: { jsonSchema?: boolean; tools?: boolean };
  fixture?: boolean;
};

export function selectStructuredProvider(candidates: StructuredProviderCandidate[], environment = process.env.NODE_ENV) {
  const provider = candidates
    .filter((candidate) => candidate.enabled && (candidate.capabilities.jsonSchema || candidate.capabilities.tools))
    .filter((candidate) => environment !== 'production' || !candidate.fixture)
    .sort((left, right) => left.priority - right.priority || left.serviceId.localeCompare(right.serviceId))[0];
  if (!provider) throw new SmartLessonPlanError('structured-provider-unavailable', 503);
  return provider;
}

export type FixtureProviderMode = 'success' | 'progressive' | 'invalid-schema' | 'retryable-failure' | 'cancelled';

export const SMART_LESSON_FIXTURE_STAGES = [
  'OUTLINE',
  'BRIDGE_IN',
  'OBJECTIVES',
  'PRE_ASSESSMENT',
  'PARTICIPATORY_LEARNING',
  'POST_ASSESSMENT',
  'SUMMARY',
] as const;

export type SmartLessonFixtureStage = typeof SMART_LESSON_FIXTURE_STAGES[number];
export type FixtureProgressEvent = {
  stage: SmartLessonFixtureStage;
  sequence: number;
  partial: { section: string; text: string };
};

const fixtureStageSchema = z.enum(SMART_LESSON_FIXTURE_STAGES);

const fixtureStageDetails: Record<Exclude<SmartLessonFixtureStage, 'OUTLINE'>, {
  title: string;
  teacherActivity: string;
  studentActivity: string;
  assessment: string;
}> = {
  BRIDGE_IN: { title: '导入', teacherActivity: '展示闭环响应曲线并提出稳定性判断问题。', studentActivity: '观察曲线并陈述初步判断。', assessment: '记录判断依据。' },
  OBJECTIVES: { title: '目标', teacherActivity: '说明本课可观察的学习目标。', studentActivity: '复述目标并识别达成标准。', assessment: '检查目标理解。' },
  PRE_ASSESSMENT: { title: '前测', teacherActivity: '给出特征方程快速判断题。', studentActivity: '独立完成并说明依据。', assessment: '依据回答调整讲解重点。' },
  PARTICIPATORY_LEARNING: { title: '参与式学习', teacherActivity: '组织小组分析参数变化对稳定域的影响。', studentActivity: '计算、讨论并汇报稳定性结论。', assessment: '使用判据核对推理过程。' },
  POST_ASSESSMENT: { title: '后测', teacherActivity: '提供新的闭环系统进行迁移检验。', studentActivity: '完成稳定性判断并提交理由。', assessment: '按结论与理由分别反馈。' },
  SUMMARY: { title: '总结', teacherActivity: '归纳稳定性判断步骤与常见错误。', studentActivity: '形成个人判断清单。', assessment: '用退出条目确认目标达成。' },
};

function fixtureStageOutput(stage: Exclude<SmartLessonFixtureStage, 'OUTLINE'>) {
  const detail = fixtureStageDetails[stage];
  return bopppsStageSchema.parse({
    minutes: 5,
    teacherActivity: detail.teacherActivity,
    studentActivity: detail.studentActivity,
    assessment: detail.assessment,
    steps: [{
      title: detail.title,
      minutes: 5,
      teacherActivity: detail.teacherActivity,
      studentActivity: detail.studentActivity,
      assessment: detail.assessment,
      sourceBindings: [],
    }],
  });
}

function fixtureOutlineOutput() {
  return smartLessonOutlineOutputSchema.parse({
    keyContent: ['闭环特征方程与稳定性判据'],
    difficultContent: ['参数变化与稳定域之间的关系'],
    limitations: ['确定性测试数据不替代真实课程依据检索'],
    classAdaptation: null,
    coursewareStepOutline: SMART_LESSON_FIXTURE_STAGES.slice(1).map((stage) => ({
      title: fixtureStageDetails[stage as Exclude<SmartLessonFixtureStage, 'OUTLINE'>].title,
      bopppsStage: ({
        BRIDGE_IN: 'bridgeIn',
        OBJECTIVES: 'objectives',
        PRE_ASSESSMENT: 'preAssessment',
        PARTICIPATORY_LEARNING: 'participatoryLearning',
        POST_ASSESSMENT: 'postAssessment',
        SUMMARY: 'summary',
      } as const)[stage as Exclude<SmartLessonFixtureStage, 'OUTLINE'>],
      minutes: 5,
    })),
  });
}

export function createDeterministicFixtureProvider(environment = process.env.NODE_ENV) {
  if (environment === 'production') throw new SmartLessonPlanError('fixture-provider-forbidden', 500);
  return {
    serviceId: 'smart-lesson-fixture',
    async generateStage(input: {
      mode: FixtureProviderMode;
      stage: SmartLessonFixtureStage;
      seed: string;
      signal?: AbortSignal;
      resumeAfterSequence?: number;
      onProgress?: (event: FixtureProgressEvent) => void | Promise<void>;
    }) {
      const stage = fixtureStageSchema.parse(input.stage);
      const assertNotCancelled = () => {
        if (input.signal?.aborted || input.mode === 'cancelled') throw new SmartLessonPlanError('generation-cancelled', 409);
      };
      assertNotCancelled();
      if (input.mode === 'retryable-failure') throw new SmartLessonPlanError('fixture-retryable-failure', 503);
      if (input.mode === 'invalid-schema') return { invalid: true };
      if (input.mode === 'progressive' && input.onProgress) {
        const progress = [
          { section: 'context', text: `fixture:${contentHash(input.seed).slice(0, 12)}` },
          { section: 'structure', text: stage },
          { section: 'validation', text: 'schema-ready' },
        ];
        for (const [index, partial] of progress.entries()) {
          const sequence = index + 1;
          if (sequence <= (input.resumeAfterSequence ?? 0)) continue;
          assertNotCancelled();
          await input.onProgress({ stage, sequence, partial });
        }
      }
      assertNotCancelled();
      return stage === 'OUTLINE' ? fixtureOutlineOutput() : fixtureStageOutput(stage);
    },
  };
}

export type DeterministicPlanCheck = { code: string; path: string; message: string };

export function deterministicPlanChecks(plan: SmartLessonPlan): DeterministicPlanCheck[] {
  const checks: DeterministicPlanCheck[] = [];
  const goalIds = new Set(plan.goals.map((goal) => goal.id));
  if (goalIds.size !== plan.goals.length) checks.push({ code: 'duplicate-goal-id', path: 'goals', message: '目标标识必须唯一。' });
  const sourceKeys = new Set(plan.sources.map((source) => `${source.sourceVersionId}:${source.anchor}:${source.contentHash}`));
  for (const goal of plan.goals) {
    for (const binding of goal.sourceBindings) {
      const key = `${binding.sourceVersionId}:${binding.anchor}:${binding.contentHash}`;
      if (!sourceKeys.has(key)) checks.push({ code: 'goal-source-not-declared', path: `goals.${goal.id}`, message: '目标引用不在教案来源集合中。' });
    }
  }
  for (const point of plan.knowledgePoints) {
    for (const binding of point.sourceBindings) {
      const key = `${binding.sourceVersionId}:${binding.anchor}:${binding.contentHash}`;
      if (!sourceKeys.has(key)) checks.push({ code: 'knowledge-source-not-declared', path: `knowledgePoints.${point.id}`, message: '知识点引用不在教案来源集合中。' });
    }
  }
  return checks;
}
