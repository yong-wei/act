/**
 * #2033 验收证据包：候选路径区分度与 OSS 读取验证。
 *
 * 产出：三族两两量化指标、偏好/画像单变量对照、读取验证故障剔除对照、
 * 学生安全投影断言。运行：
 *   npx tsx scripts/tests/adaptive-path-differentiation-evidence.ts
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildAlternativeCoreDiversityInput,
  buildPlannerPortrait,
} from '@/features/personalization/path-planning/__tests__/fixtures/alternative-core-fixture';
import { computeAdaptivePathBatchDifferentiation } from '@/features/personalization/path-planning/adaptive-path-candidate-batches';
import { planLearningPath } from '@/features/personalization/path-planning/public-api';
import {
  buildStudentSafeBatchComparison,
  buildStudentSafePathOptions,
} from '@/lib/konling-agent-runtime';

const repoRoot = path.resolve(__dirname, '../..');
const outputDir = path.join(
  repoRoot,
  'artifacts/openspec/issue-2033-oss/evidence',
);
const NOW = new Date('2026-05-27T08:00:00.000Z');

function run(resourcePreferences: string[], learnerStateOverrides: Record<string, unknown> = {}) {
  return planLearningPath(buildAlternativeCoreDiversityInput({
    resourcePreferences: resourcePreferences as never,
    resourcePreferenceSource: 'request' as never,
    learnerState: Object.keys(learnerStateOverrides).length
      ? learnerStateOverrides as never
      : undefined,
  }));
}

function strategyOf(plan: ReturnType<typeof run>, family: string) {
  const path = plan.policyBundle?.paths.find((candidate) => candidate.policyFamily === family);
  assert.ok(path?.strategy, `${family} 候选缺少 strategy 观察字段`);
  return path.strategy;
}

function pairMetrics(plan: ReturnType<typeof run>) {
  const differentiation = computeAdaptivePathBatchDifferentiation(plan);
  assert.ok(differentiation, '候选批次不足两条，无法计算区分度');
  return differentiation;
}

const evidence: Record<string, unknown> = {
  generatedAt: new Date().toISOString(),
  fixture: 'alternative-core-fixture (three-family survival, deterministic)',
};

// 1. 三族幸存与两两量化区分度。
const baseline = run([]);
const families = baseline.policyBundle?.paths.map((candidate) => candidate.policyFamily) ?? [];
assert.deepEqual(
  [...families].sort(),
  ['foundation-remediation', 'preference-matched', 'simulation-driven'],
  '三族候选必须全部幸存',
);
const baselineDifferentiation = pairMetrics(baseline);
evidence.threeFamilyDifferentiation = {
  families,
  highDifferentiation: baselineDifferentiation.highDifferentiation,
  pairs: baselineDifferentiation.pairs.map((pair) => ({
    left: pair.leftStyleId,
    right: pair.rightStyleId,
    satisfiedCount: pair.metrics.satisfiedCount,
    satisfiedRules: pair.metrics.satisfiedRules,
  })),
};

// 2. 偏好单变量切换：偏好族画像依据跟随偏好类型。
const cardRun = run(['knowledge_card']);
const textbookRun = run(['textbook_section']);
const cardStrategy = strategyOf(cardRun, 'preference-matched');
const textbookStrategy = strategyOf(textbookRun, 'preference-matched');
assert.equal(cardStrategy.strategyId, 'preference-reinforce');
assert.deepEqual(cardStrategy.portraitBasis, ['knowledge_card']);
assert.deepEqual(textbookStrategy.portraitBasis, ['textbook_section']);
evidence.preferenceSwitchContrast = {
  knowledgeCard: { portraitBasis: cardStrategy.portraitBasis, preferredTypeShare: cardStrategy.preferredTypeShare },
  textbook: { portraitBasis: textbookStrategy.portraitBasis, preferredTypeShare: textbookStrategy.preferredTypeShare },
};

// 3. 画像优势维度单变量切换：仿真族优势依据随之切换。
const basePortrait = buildPlannerPortrait(NOW, 'student-1');
const boostedPortrait = buildPlannerPortrait(NOW, 'student-1', { simulationValidationEvidence: 0.92 });
const boostedRun = run([], {
  primaryPortraitState: 'SNAPSHOT',
  primaryPortraitAvailability: 'available',
  primaryPortrait: boostedPortrait,
  knowledgeMastery: buildAlternativeCoreDiversityInput().learnerState!.knowledgeMastery!,
  evidence: {
    confidence: { level: 'medium', score: 0.68, evidenceCount: 8, sourceCompleteness: 0.7 },
    sourceCoverage: { LearningFact: 'available', ArenaSubmission: 'partial' },
  },
});
const baselineStrength = strategyOf(baseline, 'simulation-driven');
const boostedStrength = strategyOf(boostedRun, 'simulation-driven');
assert.equal(boostedStrength.portraitBasis.join(), 'simulationValidationEvidence');
assert.notEqual(boostedStrength.portraitBasis.join(), baselineStrength.portraitBasis.join());
evidence.portraitStrengthSwitch = {
  baseline: { portraitBasis: baselineStrength.portraitBasis, topDimensionScore: topDimension(basePortrait) },
  boosted: { portraitBasis: boostedStrength.portraitBasis, topDimensionScore: topDimension(boostedPortrait) },
};

// 4. 薄弱点锚定：薄弱策略依据锚定低掌握知识目标，generic 语义如实。
const weakness = strategyOf(baseline, 'foundation-remediation');
assert.equal(weakness.generic, false);
assert.ok(weakness.portraitBasis.length > 0, '薄弱策略必须携带画像依据');
const noPortraitRun = planLearningPath(buildAlternativeCoreDiversityInput({
  learnerState: {
    primaryPortraitState: 'NO_EVIDENCE',
    primaryPortraitAvailability: 'unavailable',
    knowledgeMastery: buildAlternativeCoreDiversityInput().learnerState!.knowledgeMastery!,
  } as never,
}));
assert.equal(strategyOf(noPortraitRun, 'foundation-remediation').generic, true);
evidence.weaknessAnchoring = {
  portraitBasis: weakness.portraitBasis,
  weaknessResourceCount: weakness.weaknessResourceCount,
  genericWithoutPortrait: true,
};

// 5. 读取验证故障注入：missing 对象键从覆盖统计剔除并进入审计清单。
const faultedDifferentiation = computeAdaptivePathBatchDifferentiation(baseline, {
  objectKeyReadRecords: [{
    objectKey: 'injected/unreadable-asset.mp4',
    resourceId: 'injected-resource',
    candidateStyleId: 'foundation-remediation',
    nodeNodeId: 'injected-node',
    state: 'missing',
    contentSha256: null,
    verifiedAt: NOW.toISOString(),
  }],
});
assert.ok(faultedDifferentiation);
assert.deepEqual(faultedDifferentiation.unreadableObjectKeys, ['injected/unreadable-asset.mp4']);
evidence.readVerificationFaultInjection = {
  unreadableObjectKeys: faultedDifferentiation.unreadableObjectKeys,
  note: '验证失败的资源不进入覆盖与区分度统计，批次数值与无故障运行一致地反映可信资源。',
};

// 门禁语义：highDifferentiation 是诚实标记，不达标不得复制路径凑数。
evidence.gateSemantics = {
  highDifferentiation: baselineDifferentiation.highDifferentiation,
  note: 'false 表示存在未达 3 项阈值的候选对；门禁如实标记而非放宽或复制候选。',
};

// 6. 学生安全投影：策略呈现不泄露对象键原文与内部规则名。
const projectedOptions = buildStudentSafePathOptions(baseline);
const projectedStrategies = projectedOptions.map((option) => option.strategy);
assert.ok(projectedStrategies.some((strategy) => strategy && !strategy.generic), '至少一条候选为画像驱动策略');
const comparisonMetadata = {
  differentiation: baselineDifferentiation,
  objectKeyReadRecords: [{
    objectKey: 'lessons/1-3/media/intro.mp4',
    resourceId: 'r1',
    candidateStyleId: 'foundation-remediation',
    nodeNodeId: 'node-1',
    state: 'verified',
    contentSha256: 'sha-x',
    verifiedAt: NOW.toISOString(),
  }],
};
const comparison = buildStudentSafeBatchComparison(comparisonMetadata);
const projectedJson = JSON.stringify({ projectedStrategies, comparison });
assert.ok(!projectedJson.includes('.mp4'), '投影不得包含对象键原文');
assert.ok(!projectedJson.includes('satisfiedRules'), '投影不得包含内部规则名');
evidence.studentSafeProjection = {
  strategies: projectedStrategies,
  comparison,
};

mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'differentiation-evidence.json');
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`PASS issue-2033-oss 验收证据包 → ${path.relative(repoRoot, outputPath)}`);
console.log(`  三族区分度: ${baselineDifferentiation.pairs.length} 对, highDifferentiation=${baselineDifferentiation.highDifferentiation}`);
console.log(`  偏好切换: ${JSON.stringify(cardStrategy.portraitBasis)} → ${JSON.stringify(textbookStrategy.portraitBasis)}`);
console.log(`  优势切换: ${JSON.stringify(boostedStrength.portraitBasis)}`);
console.log(`  故障剔除: ${JSON.stringify(faultedDifferentiation.unreadableObjectKeys)}`);

function topDimension(portrait: { dimensions: Array<{ id: string; score: number }> }) {
  const [top] = [...portrait.dimensions].sort((left, right) => right.score - left.score);
  return { id: top?.id ?? null, score: top?.score ?? null };
}
