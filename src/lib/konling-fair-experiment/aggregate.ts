import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  aggregateKonlingBlindAuditRun,
  konlingBlindAuditRunDir,
  loadKonlingBlindAuditRecords,
} from '@/lib/konling-blind-audit';
import { evaluateStudyQuestionStructure, type StudyQuestionScoringCaliber } from '@/lib/konling-study-question-structure';

import { konlingFairExperimentBankHash } from './bank';
import {
  buildKonlingFairExperimentDerivedAuditManifest,
  derivedAuditRunId,
} from './bank';
import { aggregateKonlingFairCitationAudit, auditKonlingFairCitationRecord } from './citation-audit';
import { buildPairedDifference, buildPairedRatioDifference, rateMetric } from './metrics';
import {
  buildKonlingFairExperimentExpertReviewReport,
  selectKonlingFairExperimentExpertSubset,
} from './expert-review';
import {
  konlingFairExperimentRunDir,
  loadKonlingFairExperimentAnswers,
  loadKonlingFairExperimentScores,
  prepareKonlingFairExperimentRun,
  releaseKonlingFairExperimentRun,
  writeKonlingFairExperimentOfficialSummary,
  writeKonlingFairExperimentScore,
} from './store';
import type {
  KonlingFairExperimentAggregateResult,
  KonlingFairExperimentCitationAuditRecord,
  KonlingFairExperimentAggregateStatus,
  KonlingFairExperimentAnswerRecord,
  KonlingFairExperimentArm,
  KonlingFairExperimentAuditDimension,
  KonlingFairExperimentBank,
  KonlingFairExperimentConfig,
  KonlingFairExperimentGradedAuditResult,
  KonlingFairExperimentGradedVerdictName,
  KonlingFairExperimentManifest,
  KonlingFairExperimentOfficialSummary,
  KonlingFairExperimentScoreRecord,
} from './types';
import {
  KONLING_FAIR_EXPERIMENT_AUDIT_DIMENSIONS,
  KONLING_FAIR_EXPERIMENT_BANK_DIFFICULTIES,
  KONLING_FAIR_EXPERIMENT_GRADED_VERDICTS,
  KONLING_FAIR_EXPERIMENT_SYNTHETIC_DISCLAIMER,
  isKonlingFairExperimentGradedAuditResult,
  buildKonlingFairExperimentTaskKey,
} from './types';

const EXPERIMENT_VERSION = 'konling-fair-experiment.v1';

export function buildKonlingFairExperimentManifestPayload(input: {
  bank: KonlingFairExperimentBank;
  arms: readonly KonlingFairExperimentArm[];
  config: KonlingFairExperimentConfig;
}): KonlingFairExperimentManifest {
  return {
    experimentVersion: EXPERIMENT_VERSION,
    bank: {
      version: input.bank.bankVersion,
      hash: konlingFairExperimentBankHash(input.bank),
      itemCount: input.bank.items.length,
      replicates: input.bank.replicates,
    },
    arms: [...input.arms],
    config: input.config,
  };
}

export function konlingFairExperimentManifestHash(manifest: KonlingFairExperimentManifest): string {
  return createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
}

function expectedTaskKeys(bank: KonlingFairExperimentBank, arm: KonlingFairExperimentArm): string[] {
  const keys: string[] = [];
  for (let replicate = 1; replicate <= bank.replicates; replicate += 1) {
    for (const item of bank.items) {
      keys.push(buildKonlingFairExperimentTaskKey({
        bankVersion: bank.bankVersion,
        arm,
        itemId: item.itemId,
        replicate,
      }));
    }
  }
  return keys.sort();
}

function configMismatch(
  record: KonlingFairExperimentAnswerRecord,
  config: KonlingFairExperimentConfig,
): { dimension: string; expected: string; observed: string } | null {
  const checks: Array<{ dimension: string; expected: string; observed: string }> = [
    { dimension: 'model', expected: config.model, observed: record.model },
    { dimension: 'provider', expected: config.provider, observed: record.provider },
    { dimension: 'sampling', expected: JSON.stringify(config.sampling), observed: JSON.stringify(record.sampling) },
    { dimension: `promptVersion(${record.arm})`, expected: config.armPromptVersions[record.arm], observed: record.promptVersion },
    { dimension: 'gitRevision', expected: config.gitRevision, observed: record.gitRevision },
  ];
  return checks.find((check) => check.expected !== check.observed) ?? null;
}

interface AuditArmEvidence {
  /** key = `${itemId}--r${replicate}` → 盲审判定 pass 等价（graded：非 major-error）。 */
  verdicts: Map<string, boolean>;
  ruleScores: number[];
  /** #1952：graded 记录（rubric-graded.v2）；二元 rubric 运行为 null。 */
  graded: Map<string, KonlingFairExperimentGradedAuditResult> | null;
  complete: boolean;
}

/**
 * manifest 声明的 rubric 家族：`rubric-graded.*` 要求全部记录为分级形态，
 * 其余（rubric.v1）要求二元形态。记录形态与配置不符（例如 graded 配置
 * 误接二元评审器）按 parse-failure 语义 fail closed，不得进入正式指标。
 */
function expectsGradedRubric(config: KonlingFairExperimentConfig): boolean {
  return config.audit.scoreVersion.startsWith('rubric-graded');
}

function auditArmEvidence(
  root: string,
  runId: string,
  bank: KonlingFairExperimentBank,
  arm: KonlingFairExperimentArm,
  answers: readonly KonlingFairExperimentAnswerRecord[],
  expectedGraded: boolean,
): AuditArmEvidence {
  const verdicts = new Map<string, boolean>();
  const ruleScores: number[] = [];
  const graded = new Map<string, KonlingFairExperimentGradedAuditResult>();
  let rubricMismatch = false;
  for (let replicate = 1; replicate <= bank.replicates; replicate += 1) {
    const derivedRunId = derivedAuditRunId(runId, arm, replicate);
    const derivedManifest = buildKonlingFairExperimentDerivedAuditManifest({
      bank, arm, replicate, answers,
    });
    const aggregate = aggregateKonlingBlindAuditRun({
      root,
      runId: derivedRunId,
      manifest: derivedManifest,
      mode: 'blind-audit',
    });
    if (aggregate.status !== 'complete') {
      return { verdicts, ruleScores, graded: null, complete: false };
    }
    const records = loadKonlingBlindAuditRecords(konlingBlindAuditRunDir(root, derivedRunId), 'blind-audit');
    for (const record of records) {
      const auditKey = `${record.itemId}--r${replicate}`;
      const gradedResult = isKonlingFairExperimentGradedAuditResult(record.result)
        ? record.result
        : null;
      if ((gradedResult !== null) !== expectedGraded) {
        rubricMismatch = true;
        continue;
      }
      if (gradedResult) {
        graded.set(auditKey, gradedResult);
        // graded rubric 的 pass 等价：仅 major-error 视为不通过——correct 与
        // minor-flaw 都是可接受回答，三级区分进入 verdictDistribution 与子分。
        verdicts.set(auditKey, gradedResult.verdict !== 'major-error');
        ruleScores.push(gradedResult.ruleScore);
      } else {
        const result = record.result as { verdict?: unknown; ruleScore?: unknown } | undefined;
        verdicts.set(auditKey, result?.verdict === 'pass');
        if (typeof result?.ruleScore === 'number') ruleScores.push(result.ruleScore);
      }
    }
  }
  return {
    verdicts,
    ruleScores,
    graded: graded.size > 0 && !rubricMismatch ? graded : null,
    complete: !rubricMismatch && verdicts.size >= bank.items.length * bank.replicates,
  };
}

/** #1952：per arm 五子分均值、verdict 分布与天花板/地板比例。 */
function gradedAuditDimensions(
  graded: Map<string, KonlingFairExperimentGradedAuditResult>,
): NonNullable<KonlingFairExperimentOfficialSummary['perArm'][KonlingFairExperimentArm]['auditDimensions']> {
  const results = [...graded.values()];
  const verdictDistribution = Object.fromEntries(
    KONLING_FAIR_EXPERIMENT_GRADED_VERDICTS.map((verdict) => [
      verdict,
      results.filter((result) => result.verdict === verdict).length,
    ]),
  ) as Record<KonlingFairExperimentGradedVerdictName, number>;
  const meanSubscores = Object.fromEntries(
    KONLING_FAIR_EXPERIMENT_AUDIT_DIMENSIONS.map((dimension) => [
      dimension,
      results.reduce((sum, result) => sum + result.subscores[dimension], 0) / results.length,
    ]),
  ) as Record<KonlingFairExperimentAuditDimension, number>;
  return {
    verdictDistribution,
    meanSubscores,
    ceilingProportion: results.filter((result) => result.ruleScore >= 0.95).length / results.length,
    floorProportion: results.filter((result) => result.ruleScore <= 0.05).length / results.length,
  };
}

/**
 * fail-closed 聚合：完整性门禁（缺键/多键/混配置/盲审不完整）通过后才
 * 组装正式指标；否则不写 official 汇总并返回失败详情（#1900）。
 */
export function aggregateKonlingFairExperiment(input: {
  root: string;
  runId: string;
  bank: KonlingFairExperimentBank;
  arms: readonly KonlingFairExperimentArm[];
  config: KonlingFairExperimentConfig;
  calibers: readonly StudyQuestionScoringCaliber[];
  writeOfficial: boolean;
}): KonlingFairExperimentAggregateResult {
  const runDir = konlingFairExperimentRunDir(input.root, input.runId);
  const manifestPath = path.join(runDir, 'manifest.snapshot.json');
  if (!fs.existsSync(manifestPath)) {
    return { runId: input.runId, status: 'manifest-missing', expected: 0, officialSummary: null };
  }
  const expectedPerArm = input.bank.items.length * input.bank.replicates;
  const incomplete = (detail: NonNullable<KonlingFairExperimentAggregateResult['incompleteDetail']>): KonlingFairExperimentAggregateResult => ({
    runId: input.runId,
    status: 'incomplete' satisfies KonlingFairExperimentAggregateStatus,
    expected: expectedPerArm,
    officialSummary: null,
    incompleteDetail: detail,
  });

  const answersByArm = new Map<KonlingFairExperimentArm, KonlingFairExperimentAnswerRecord[]>();
  const scoresByCaliberArm = new Map<string, KonlingFairExperimentScoreRecord[]>();
  const auditsByArm = new Map<KonlingFairExperimentArm, AuditArmEvidence>();

  for (const arm of input.arms) {
    const expectedKeys = expectedTaskKeys(input.bank, arm);
    const records = loadKonlingFairExperimentAnswers(runDir, arm);
    const actualKeys = records.map((record) => record.taskKey).sort();
    const missing = expectedKeys.filter((key) => !actualKeys.includes(key));
    const unexpected = actualKeys.filter((key) => !expectedKeys.includes(key));
    if (missing.length > 0 || unexpected.length > 0) {
      return incomplete({ phase: 'generate', arm, missingTaskKeys: missing, unexpectedKeys: unexpected });
    }
    for (const record of records) {
      const mismatch = configMismatch(record, input.config);
      if (mismatch) {
        return {
          runId: input.runId,
          status: 'mixed-configuration',
          expected: expectedPerArm,
          officialSummary: null,
          mixedConfigurationDetail: { ...mismatch, taskKey: record.taskKey },
        };
      }
    }
    answersByArm.set(arm, records);

    for (const caliber of input.calibers) {
      const scores = loadKonlingFairExperimentScores(runDir, caliber, input.config.scorerRevision, arm);
      const scoreKeys = new Set(scores.map((score) => score.taskKey));
      const scoreMissing = expectedKeys.filter((key) => !scoreKeys.has(key));
      if (scoreMissing.length > 0 || scores.length !== expectedKeys.length) {
        return incomplete({ phase: 'score', arm, missingTaskKeys: scoreMissing });
      }
      const foreignRevision = scores.find((score) => score.gitRevision !== input.config.scorerRevision);
      if (foreignRevision) {
        return {
          runId: input.runId,
          status: 'mixed-configuration',
          expected: expectedPerArm,
          officialSummary: null,
          mixedConfigurationDetail: {
            dimension: 'scorerRevision',
            expected: input.config.scorerRevision,
            observed: foreignRevision.gitRevision,
            taskKey: foreignRevision.taskKey,
          },
        };
      }
      scoresByCaliberArm.set(`${caliber}--${arm}`, scores);
    }

    if (input.config.audit.enabled) {
      const evidence = auditArmEvidence(
        input.root, input.runId, input.bank, arm, records,
        expectsGradedRubric(input.config),
      );
      if (!evidence.complete) {
        return incomplete({ phase: 'audit', arm });
      }
      auditsByArm.set(arm, evidence);
    }
  }

  // —— 完整性门禁通过，组装指标 ——
  const perArm: KonlingFairExperimentOfficialSummary['perArm'] = {} as KonlingFairExperimentOfficialSummary['perArm'];
  const allCitationAuditRecords: KonlingFairExperimentCitationAuditRecord[] = [];
  const citationAuditByArm = new Map<KonlingFairExperimentArm, KonlingFairExperimentCitationAuditRecord[]>();
  const structureOutcomes = new Map<string, KonlingFairExperimentScoreRecord[]>();
  const auditOutcomes = new Map<KonlingFairExperimentArm, Array<{ auditKey: string; passed: boolean }>>();
  const compositeOutcomes = new Map<string, Array<{ taskKey: string; passed: boolean }>>();

  for (const arm of input.arms) {
    const audit = auditsByArm.get(arm) ?? null;
    const structure: Record<string, ReturnType<typeof rateMetric>> = {};
    const composite: KonlingFairExperimentOfficialSummary['perArm'][KonlingFairExperimentArm]['composite'] = {};
    for (const caliber of input.calibers) {
      const scores = scoresByCaliberArm.get(`${caliber}--${arm}`) ?? [];
      structureOutcomes.set(`${caliber}--${arm}`, scores);
      structure[caliber] = rateMetric(scores.map((score) => score.passed));
      if (audit) {
        const compositeList = scores.map((score) => ({
          taskKey: score.taskKey,
          passed: score.passed && audit.verdicts.get(`${score.itemId}--r${score.replicate}`) === true,
        }));
        compositeOutcomes.set(`${caliber}--${arm}`, compositeList);
        composite[caliber] = {
          ...rateMetric(compositeList.map((entry) => entry.passed)),
          components: {
            structure: structure[caliber],
            audit: rateMetric([...audit.verdicts.values()]),
          },
        };
      }
    }
    let classificationAgreement: KonlingFairExperimentOfficialSummary['perArm'][KonlingFairExperimentArm]['classificationAgreement'] = null;
    if (arm === 'full-feature') {
      const answers = answersByArm.get(arm) ?? [];
      // #1948：总体一致率之外输出逐意图混淆分解，类别级失败不得被总体率掩盖。
      // 按题库标注意图分组聚合：同意图多条目（真实批次可追加）必须汇入同一条
      // 分解，不得按题项拆散（review finding：分组单位是意图，不是题项）。
      const intents = [...new Set(input.bank.items.map((item) => item.intent))];
      const byIntent = intents.map((intent) => {
        const itemIds = new Set(
          input.bank.items.filter((item) => item.intent === intent).map((item) => item.itemId),
        );
        const records = answers.filter((record) => itemIds.has(record.itemId));
        const routedCounts: Record<string, number> = {};
        let matched = 0;
        for (const record of records) {
          const routed = record.contractIntent ?? 'null';
          routedCounts[routed] = (routedCounts[routed] ?? 0) + 1;
          if (record.contractIntent === intent) matched += 1;
        }
        return {
          intent,
          n: records.length,
          matched,
          rate: records.length === 0 ? 0 : matched / records.length,
          routedCounts,
        };
      });
      classificationAgreement = {
        ...rateMetric(answers.map((record) => {
          const item = input.bank.items.find((candidate) => candidate.itemId === record.itemId);
          return record.contractIntent === (item?.intent ?? null);
        })),
        byIntent,
      };
    }
    // #1951：确定性 citation 审计。旧 run 冻结回答无 citations 字段时
    // fail closed（phase 'citation-audit'），不写 official。
    const answers = answersByArm.get(arm) ?? [];
    const citationAuditRecords: KonlingFairExperimentCitationAuditRecord[] = [];
    for (const record of answers) {
      if (!Array.isArray(record.citations)) {
        return {
          runId: input.runId,
          status: 'incomplete',
          expected: expectedPerArm,
          officialSummary: null,
          incompleteDetail: {
            phase: 'citation-audit',
            arm,
            missingTaskKeys: [record.taskKey],
          },
        } satisfies KonlingFairExperimentAggregateResult;
      }
      const item = input.bank.items.find((candidate) => candidate.itemId === record.itemId);
      if (!item) {
        return {
          runId: input.runId,
          status: 'incomplete',
          expected: expectedPerArm,
          officialSummary: null,
          incompleteDetail: {
            phase: 'citation-audit',
            arm,
            missingTaskKeys: [record.taskKey],
          },
        } satisfies KonlingFairExperimentAggregateResult;
      }
      citationAuditRecords.push(auditKonlingFairCitationRecord({
        taskKey: record.taskKey,
        arm,
        itemId: record.itemId,
        replicate: record.replicate,
        intent: item.intent,
        answer: record.answer,
        citations: record.citations,
      }));
    }
    allCitationAuditRecords.push(...citationAuditRecords);
    citationAuditByArm.set(arm, citationAuditRecords);
    perArm[arm] = {
      structure,
      audit: audit
        ? {
          ...rateMetric([...audit.verdicts.values()]),
          meanRuleScore: audit.ruleScores.length === 0
            ? 0
            : audit.ruleScores.reduce((sum, value) => sum + value, 0) / audit.ruleScores.length,
        }
        : null,
      composite,
      classificationAgreement,
      // #1952：graded rubric 记录才产出判别力维度；二元 rubric 保持 null。
      auditDimensions: audit?.graded ? gradedAuditDimensions(audit.graded) : null,
      citationAudit: aggregateKonlingFairCitationAudit(citationAuditRecords),
    };
    if (audit) {
      auditOutcomes.set(arm, [...audit.verdicts.entries()]
        .map(([auditKey, passed]) => ({ auditKey, passed }))
        .sort((a, b) => a.auditKey.localeCompare(b.auditKey)));
    }
  }

  const seed = String(input.config.sampling.seed);
  const iterations = input.config.bootstrapIterations;
  const armPairs: Array<[KonlingFairExperimentArm, KonlingFairExperimentArm]> = [
    ['plain-baseline', 'enhanced-baseline'],
    ['plain-baseline', 'full-feature'],
    ['enhanced-baseline', 'full-feature'],
  ];

  // —— #1952：难度×意图分层结果与分层配对差值；V1 题库（无分层标注）为空 ——
  // 层内通过率为三臂合并口径（臂间比较见 stratifiedDeltas）；层样本量
  // = 条目 × replicates × 臂数，CI 宽属预期（design 已注明）。
  const stratifiedLayers: KonlingFairExperimentOfficialSummary['stratified']['layers'] = [];
  const stratifiedDeltas: KonlingFairExperimentOfficialSummary['stratified']['stratifiedDeltas'] = [];
  const difficultiesPresent = KONLING_FAIR_EXPERIMENT_BANK_DIFFICULTIES.filter((difficulty) =>
    input.bank.items.some((item) => item.difficulty === difficulty));
  const intentsPresent = [...new Set(input.bank.items.map((item) => item.intent))];
  for (const difficulty of difficultiesPresent) {
    for (const intent of intentsPresent) {
      const layerItems = input.bank.items.filter((item) =>
        item.intent === intent && item.difficulty === difficulty);
      if (layerItems.length === 0) continue;
      const layerItemIds = new Set(layerItems.map((item) => item.itemId));
      const structure: Record<string, ReturnType<typeof rateMetric>> = {};
      for (const caliber of input.calibers) {
        const pooled: boolean[] = [];
        for (const arm of input.arms) {
          pooled.push(...(scoresByCaliberArm.get(`${caliber}--${arm}`) ?? [])
            .filter((score) => layerItemIds.has(score.itemId))
            .map((score) => score.passed));
        }
        structure[caliber] = rateMetric(pooled);
      }
      const layerGraded: KonlingFairExperimentGradedAuditResult[] = [];
      for (const evidence of auditsByArm.values()) {
        if (!evidence.graded) continue;
        for (const item of layerItems) {
          for (let replicate = 1; replicate <= input.bank.replicates; replicate += 1) {
            const result = evidence.graded.get(`${item.itemId}--r${replicate}`);
            if (result) layerGraded.push(result);
          }
        }
      }
      const meanSubscores = layerGraded.length === 0
        ? null
        : Object.fromEntries(KONLING_FAIR_EXPERIMENT_AUDIT_DIMENSIONS.map((dimension) => [
          dimension,
          layerGraded.reduce((sum, result) => sum + result.subscores[dimension], 0) / layerGraded.length,
        ])) as Record<KonlingFairExperimentAuditDimension, number>;
      stratifiedLayers.push({ difficulty, intent, itemCount: layerItems.length, structure, meanSubscores });

      for (const caliber of input.calibers) {
        for (const [baselineArm, comparisonArm] of armPairs) {
          // 两臂评分记录同源排序（taskKey 字典序），过滤后配对对齐。
          const baselineOutcomes = (scoresByCaliberArm.get(`${caliber}--${baselineArm}`) ?? [])
            .filter((score) => layerItemIds.has(score.itemId))
            .map((score) => score.passed);
          const comparisonOutcomes = (scoresByCaliberArm.get(`${caliber}--${comparisonArm}`) ?? [])
            .filter((score) => layerItemIds.has(score.itemId))
            .map((score) => score.passed);
          const delta = buildPairedDifference({
            metric: `stratified-structure@${caliber}:${difficulty}/${intent}`,
            baselineLabel: baselineArm,
            comparisonLabel: comparisonArm,
            baselineOutcomes,
            comparisonOutcomes,
            seedParts: [seed, 'stratified-structure', caliber, difficulty, intent, baselineArm, comparisonArm],
            iterations,
          });
          if (delta) stratifiedDeltas.push(delta);
        }
      }
    }
  }
  const generationDeltas: KonlingFairExperimentOfficialSummary['generationDeltas'] = [];
  for (const caliber of input.calibers) {
    for (const [baselineArm, comparisonArm] of armPairs) {
      const structureDelta = buildPairedDifference({
        metric: `structure@${caliber}`,
        baselineLabel: baselineArm,
        comparisonLabel: comparisonArm,
        baselineOutcomes: (structureOutcomes.get(`${caliber}--${baselineArm}`) ?? []).map((score) => score.passed),
        comparisonOutcomes: (structureOutcomes.get(`${caliber}--${comparisonArm}`) ?? []).map((score) => score.passed),
        seedParts: [seed, 'structure', caliber, baselineArm, comparisonArm],
        iterations,
      });
      if (structureDelta) generationDeltas.push(structureDelta);
      const compositeBaseline = compositeOutcomes.get(`${caliber}--${baselineArm}`);
      const compositeComparison = compositeOutcomes.get(`${caliber}--${comparisonArm}`);
      if (compositeBaseline && compositeComparison) {
        const compositeDelta = buildPairedDifference({
          metric: `composite@${caliber}`,
          baselineLabel: baselineArm,
          comparisonLabel: comparisonArm,
          baselineOutcomes: compositeBaseline.map((entry) => entry.passed),
          comparisonOutcomes: compositeComparison.map((entry) => entry.passed),
          seedParts: [seed, 'composite', caliber, baselineArm, comparisonArm],
          iterations,
        });
        if (compositeDelta) generationDeltas.push(compositeDelta);
      }
    }
  }
  for (const [baselineArm, comparisonArm] of armPairs) {
    const baseline = auditOutcomes.get(baselineArm);
    const comparison = auditOutcomes.get(comparisonArm);
    if (!baseline || !comparison || baseline.length === 0) continue;
    const delta = buildPairedDifference({
      metric: 'audit-verdict',
      baselineLabel: baselineArm,
      comparisonLabel: comparisonArm,
      baselineOutcomes: baseline.map((entry) => entry.passed),
      comparisonOutcomes: comparison.map((entry) => entry.passed),
      seedParts: [seed, 'audit-verdict', baselineArm, comparisonArm],
      iterations,
    });
    if (delta) generationDeltas.push(delta);
  }

  // #1951：两指标的臂间配对差，配对单位是题项（replicate 池化到 itemId）。
  const citationAuditDeltas: KonlingFairExperimentOfficialSummary['citationAuditDeltas'] = [];
  const itemIds = input.bank.items.map((item) => item.itemId);
  for (const [baselineArm, comparisonArm] of armPairs) {
    const baselineRecords = citationAuditByArm.get(baselineArm) ?? [];
    const comparisonRecords = citationAuditByArm.get(comparisonArm) ?? [];
    if (baselineRecords.length === 0 || comparisonRecords.length === 0) continue;
    for (const metric of ['precision', 'coverage'] as const) {
      const numeratorKey = metric === 'precision' ? 'verifiedSupportingCount' : 'coveredUnitCount';
      const denominatorKey = metric === 'precision' ? 'presentedCitationCount' : 'requiredUnitCount';
      const delta = buildPairedRatioDifference({
        metric: `citation-${metric}`,
        baselineLabel: baselineArm,
        comparisonLabel: comparisonArm,
        baselinePairedRatios: itemIds.map((itemId) => {
          const records = baselineRecords.filter((record) => record.itemId === itemId);
          return {
            numerator: records.reduce((sum, record) => sum + record[numeratorKey], 0),
            denominator: records.reduce((sum, record) => sum + record[denominatorKey], 0),
          };
        }),
        comparisonPairedRatios: itemIds.map((itemId) => {
          const records = comparisonRecords.filter((record) => record.itemId === itemId);
          return {
            numerator: records.reduce((sum, record) => sum + record[numeratorKey], 0),
            denominator: records.reduce((sum, record) => sum + record[denominatorKey], 0),
          };
        }),
        seedParts: [seed, 'citation-audit', metric, baselineArm, comparisonArm],
        iterations,
      });
      if (delta) citationAuditDeltas.push(delta);
    }
  }

  const caliberDeltas: KonlingFairExperimentOfficialSummary['caliberDeltas'] = [];
  if (input.calibers.length >= 2) {
    const [referenceCaliber, ...otherCalibers] = input.calibers;
    for (const caliber of otherCalibers) {
      for (const arm of input.arms) {
        const delta = buildPairedDifference({
          metric: `caliber:${referenceCaliber}->${caliber}`,
          baselineLabel: `${arm}@${referenceCaliber}`,
          comparisonLabel: `${arm}@${caliber}`,
          baselineOutcomes: (structureOutcomes.get(`${referenceCaliber}--${arm}`) ?? []).map((score) => score.passed),
          comparisonOutcomes: (structureOutcomes.get(`${caliber}--${arm}`) ?? []).map((score) => score.passed),
          seedParts: [seed, 'caliber', referenceCaliber, caliber, arm],
          iterations,
        });
        if (delta) caliberDeltas.push(delta);
      }
    }
  }

  const manifest = buildKonlingFairExperimentManifestPayload({
    bank: input.bank,
    arms: input.arms,
    config: input.config,
  });
  // #1952：教师双人复核校准——确定性子集 + 可选人工记录；缺失 pending 不阻塞。
  const expertReview = buildKonlingFairExperimentExpertReviewReport({
    runDir,
    subsetItemIds: selectKonlingFairExperimentExpertSubset({
      bank: input.bank,
      seed: input.config.sampling.seed,
    }),
  });
  const officialSummary: KonlingFairExperimentOfficialSummary = {
    runId: input.runId,
    experimentVersion: EXPERIMENT_VERSION,
    status: 'complete',
    bank: manifest.bank,
    config: input.config,
    calibers: [...input.calibers],
    perArm,
    stratified: { layers: stratifiedLayers, stratifiedDeltas },
    expertReview,
    syntheticDisclaimer: KONLING_FAIR_EXPERIMENT_SYNTHETIC_DISCLAIMER,
    citationAuditRecords: allCitationAuditRecords,
    generationDeltas,
    caliberDeltas,
    citationAuditDeltas,
  };

  if (input.writeOfficial) {
    writeKonlingFairExperimentOfficialSummary(runDir, officialSummary);
  }
  return { runId: input.runId, status: 'complete', expected: expectedPerArm, officialSummary };
}

/**
 * 评分器口径回放（#1900）：对既有运行目录的冻结快照按新口径重新评分，
 * 不触碰生成 provider，不修改任何回答文件；输出独立回放报告。
 */
export function replayKonlingFairExperimentScoring(input: {
  root: string;
  runId: string;
  bank: KonlingFairExperimentBank;
  calibers: readonly StudyQuestionScoringCaliber[];
  scorerRevision: string;
}): KonlingFairExperimentAggregateResult & { replayReportPath: string | null } {
  const runDir = konlingFairExperimentRunDir(input.root, input.runId);
  const snapshot = JSON.parse(fs.readFileSync(path.join(runDir, 'manifest.snapshot.json'), 'utf8')) as {
    manifestHash: string;
    payload: KonlingFairExperimentManifest;
  };
  // 快照自完整性：重算哈希防御被篡改/损坏的 manifest 快照。
  if (konlingFairExperimentManifestHash(snapshot.payload) !== snapshot.manifestHash) {
    throw new Error(`experiment manifest snapshot integrity failure for replay: ${input.runId}`);
  }
  if (snapshot.payload.bank.hash !== konlingFairExperimentBankHash(input.bank)) {
    throw new Error(`bank hash mismatch for replay: expected ${snapshot.payload.bank.hash}`);
  }
  prepareKonlingFairExperimentRun({
    root: input.root,
    runId: input.runId,
    manifestHash: snapshot.manifestHash,
    manifestPayload: snapshot.payload,
  });
  try {
    const arms = snapshot.payload.arms;
    for (const caliber of input.calibers) {
      for (const arm of arms) {
        for (const record of loadKonlingFairExperimentAnswers(runDir, arm)) {
          const item = input.bank.items.find((candidate) => candidate.itemId === record.itemId);
          if (!item) continue;
          const evaluation = evaluateStudyQuestionStructure({
            answer: record.answer,
            intent: item.intent,
            caliber,
          });
          writeKonlingFairExperimentScore(runDir, caliber, input.scorerRevision, arm, {
            taskKey: record.taskKey,
            caliber,
            arm,
            bankVersion: input.bank.bankVersion,
            itemId: record.itemId,
            replicate: record.replicate,
            intent: item.intent,
            passed: evaluation.passed,
            matchedIds: evaluation.matchedIds,
            missingIds: evaluation.missingIds,
            scoredAt: new Date().toISOString(),
            gitRevision: input.scorerRevision,
          });
        }
      }
    }
    const aggregate = aggregateKonlingFairExperiment({
      root: input.root,
      runId: input.runId,
      bank: input.bank,
      arms,
      // 回放按自身 scorerRevision 定位评分命名空间；生成侧配置仍来自
      // 冻结 manifest（answers 校验用 gitRevision，不受影响）。
      config: { ...snapshot.payload.config, scorerRevision: input.scorerRevision },
      calibers: input.calibers,
      writeOfficial: false,
    });
    if (!aggregate.officialSummary) return { ...aggregate, replayReportPath: null };
    const reportPath = path.join(runDir, 'summary', `replay-${input.calibers.join('+')}.json`);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(aggregate.officialSummary, null, 2), 'utf8');
    return { ...aggregate, replayReportPath: reportPath };
  } finally {
    releaseKonlingFairExperimentRun(runDir);
  }
}
