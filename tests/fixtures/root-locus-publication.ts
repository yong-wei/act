import { BOPPPS_STAGES } from '@/features/interactive/shared/manifest-runtime/generated-slide-contract';
import { contentHash } from '@/lib/smart-lesson-plan/domain';
import { validPlanFixture } from '@/lib/smart-lesson-plan/__tests__/fixtures';
import type { SmartLessonPlan } from '@/lib/smart-lesson-plan/schema';
import { validCompositionInput } from '@/lib/smart-courseware/__tests__/fixtures';

/** Deterministic automated acceptance provider. It is not evidence for the real-provider AC. */
export const ROOT_LOCUS_ACCEPTANCE_PROVIDER = Object.freeze({
  serviceId: 'root-locus-task-3-1-fixture',
  providerKind: 'DETERMINISTIC_FIXTURE',
  model: 'root-locus-acceptance-v1',
  acceptanceScope: 'task-3.1-only',
});

export const ROOT_LOCUS_KONLING_TURNS = Object.freeze([
  {
    turn: 1,
    user: '请为自动化专业本科生创建一节45分钟根轨迹课。',
    clarification: { question: '根轨迹课程应聚焦哪些判据？', alternatives: ['幅值与相角条件', '仅绘图规则'] },
  },
  {
    turn: 2,
    user: '选择幅值与相角条件，并加入基本绘图规则。',
    confirmed: { durationMinutes: 45, audience: '自动化专业本科生', focus: ['幅值条件', '相角条件', '基本绘图规则'] },
  },
  {
    turn: 3,
    user: '修订约束：参与式学习至少20分钟，学生必须完成可执行判断活动。',
    revision: { participatoryMinutes: 20, executableActivityRequired: true },
  },
]);

export const ROOT_LOCUS_AUTHORITATIVE_SOURCE_TEXT = [
  '# 相角条件\n根轨迹上的点满足开环相角为奇数倍180度。',
  '# 幅值条件\n由幅值条件计算指定根轨迹点对应的增益。',
  '# 基本绘图规则\n分支起于开环极点并终止于开环零点或无穷远。',
].join('\n\n');

export const ROOT_LOCUS_AUTHORITATIVE_ANCHORS = Object.freeze([
  { citationId: 'root-locus-anchor-angle', sourceVersionId: 'root-locus-source-v1', anchor: 'chapter-6.angle-condition', contentHash: '1'.repeat(64) },
  { citationId: 'root-locus-anchor-magnitude', sourceVersionId: 'root-locus-source-v1', anchor: 'chapter-6.magnitude-condition', contentHash: '2'.repeat(64) },
  { citationId: 'root-locus-anchor-rules', sourceVersionId: 'root-locus-source-v1', anchor: 'chapter-6.drawing-rules', contentHash: '3'.repeat(64) },
]);

const ROOT_LOCUS_GENERATED_COURSEWARE_COPY = Object.freeze([
  '根轨迹上的点满足开环相角为奇数倍180度。请据此判断候选点。',
  '由幅值条件计算指定根轨迹点对应的增益。请写出计算结果。',
  '分支起于开环极点并终止于开环零点或无穷远。请标注分支起止点。',
]);

export function rootLocusPlanFixture() {
  const plan = structuredClone(validPlanFixture()) as unknown as SmartLessonPlan;
  const minutes = [5, 4, 6, 20, 6, 4];
  plan.topic = '根轨迹幅值条件、相角条件与基本绘图规则';
  plan.durationMinutes = 45;
  plan.goals = [{
    id: 'goal-root-locus',
    content: '运用幅值条件与相角条件判断根轨迹，并完成基本绘图。',
    sourceState: 'VERIFIED',
    sourceBindings: ROOT_LOCUS_AUTHORITATIVE_ANCHORS.map(sourceBinding),
    gapIdentity: null,
    standardsMappings: [],
  }];
  plan.knowledgePoints = ROOT_LOCUS_AUTHORITATIVE_ANCHORS.map((anchor, index) => ({
    id: `kp-root-locus-${index + 1}`,
    title: ['相角条件', '幅值条件', '基本绘图规则'][index],
    sourceState: 'VERIFIED' as const,
    sourceBindings: [sourceBinding(anchor)],
    gapIdentity: null,
  }));
  plan.sources = ROOT_LOCUS_AUTHORITATIVE_ANCHORS.map(sourceBinding);
  plan.limitations = [];
  const stages = Object.values(plan.boppps);
  stages.forEach((stage, index) => {
    stage.minutes = minutes[index];
    stage.steps[0].minutes = minutes[index];
    stage.steps[0].sourceBindings = [sourceBinding(ROOT_LOCUS_AUTHORITATIVE_ANCHORS[Math.min(index, 2)])];
  });
  plan.coursewareStepOutline = plan.coursewareStepOutline.map((step, index) => ({ ...step, minutes: minutes[index] }));
  return plan;
}

export function rootLocusCoursewareFixture() {
  const composition = validCompositionInput();
  const plan = rootLocusPlanFixture();
  composition.runtimeManifest.title = plan.topic;
  composition.runtimeManifest.durationSeconds = 2_700;
  composition.runtimeManifest.stages.forEach((stage, index) => {
    const seconds = plan.coursewareStepOutline[index].minutes * 60;
    stage.durationSeconds = seconds;
    stage.steps[0].durationSeconds = seconds;
    const coursewareModule = stage.steps[0].modules[0];
    if (coursewareModule.canonicalClass === 'content.rich') coursewareModule.payload = { text: ROOT_LOCUS_GENERATED_COURSEWARE_COPY[Math.min(index, 2)] };
  });
  composition.moduleMetadata = composition.moduleMetadata.map((metadata, index) => ({
    ...metadata,
    sourceState: 'verified' as const,
    sourceBindings: [sourceBinding(ROOT_LOCUS_AUTHORITATIVE_ANCHORS[Math.min(index, 2)])],
  }));
  return {
    plan,
    composition,
    comparisons: compareRootLocusManifestAgainstSource(ROOT_LOCUS_AUTHORITATIVE_SOURCE_TEXT, composition.runtimeManifest),
    expectedStages: [...BOPPPS_STAGES],
  };
}

export function compareRootLocusManifestAgainstSource(sourceText: string, manifest: unknown) {
  const sourceClaims = sourceText
    .split(/\n\s*\n/)
    .map((section) => section.split('\n').slice(1).join(' ').trim())
    .filter(Boolean);
  const generatedText = collectStringLeaves(manifest).join('\n');
  return sourceClaims.map((claim, index) => {
    const matches = generatedText.includes(claim);
    return {
      anchor: ROOT_LOCUS_AUTHORITATIVE_ANCHORS[index]?.anchor ?? `source-section-${index + 1}`,
      expectedClaimHash: contentHash(claim),
      generatedClaimHash: matches ? contentHash(claim) : null,
      matches,
    };
  });
}

function collectStringLeaves(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStringLeaves);
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStringLeaves);
  return [];
}

function sourceBinding(anchor: typeof ROOT_LOCUS_AUTHORITATIVE_ANCHORS[number]) {
  return {
    citationId: anchor.citationId,
    sourceVersionId: anchor.sourceVersionId,
    anchor: anchor.anchor,
    contentHash: anchor.contentHash,
  };
}
