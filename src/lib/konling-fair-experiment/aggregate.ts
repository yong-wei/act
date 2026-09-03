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
import { buildPairedDifference, rateMetric } from './metrics';
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
  KonlingFairExperimentAggregateStatus,
  KonlingFairExperimentAnswerRecord,
  KonlingFairExperimentArm,
  KonlingFairExperimentBank,
  KonlingFairExperimentConfig,
  KonlingFairExperimentManifest,
  KonlingFairExperimentOfficialSummary,
  KonlingFairExperimentScoreRecord,
} from './types';
import { buildKonlingFairExperimentTaskKey } from './types';

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
  /** key = `${itemId}--r${replicate}` → 盲审判定是否 pass。 */
  verdicts: Map<string, boolean>;
  ruleScores: number[];
  complete: boolean;
}

function auditArmEvidence(
  root: string,
  runId: string,
  bank: KonlingFairExperimentBank,
  arm: KonlingFairExperimentArm,
  answers: readonly KonlingFairExperimentAnswerRecord[],
): AuditArmEvidence {
  const verdicts = new Map<string, boolean>();
  const ruleScores: number[] = [];
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
      return { verdicts, ruleScores, complete: false };
    }
    const records = loadKonlingBlindAuditRecords(konlingBlindAuditRunDir(root, derivedRunId), 'blind-audit');
    for (const record of records) {
      const result = record.result as { verdict?: unknown; ruleScore?: unknown } | undefined;
      verdicts.set(`${record.itemId}--r${replicate}`, result?.verdict === 'pass');
      if (typeof result?.ruleScore === 'number') ruleScores.push(result.ruleScore);
    }
  }
  return { verdicts, ruleScores, complete: verdicts.size >= bank.items.length * bank.replicates };
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
      const scores = loadKonlingFairExperimentScores(runDir, caliber, arm);
      const scoreKeys = new Set(scores.map((score) => score.taskKey));
      const scoreMissing = expectedKeys.filter((key) => !scoreKeys.has(key));
      if (scoreMissing.length > 0 || scores.length !== expectedKeys.length) {
        return incomplete({ phase: 'score', arm, missingTaskKeys: scoreMissing });
      }
      scoresByCaliberArm.set(`${caliber}--${arm}`, scores);
    }

    if (input.config.audit.enabled) {
      const evidence = auditArmEvidence(input.root, input.runId, input.bank, arm, records);
      if (!evidence.complete) {
        return incomplete({ phase: 'audit', arm });
      }
      auditsByArm.set(arm, evidence);
    }
  }

  // —— 完整性门禁通过，组装指标 ——
  const perArm: KonlingFairExperimentOfficialSummary['perArm'] = {} as KonlingFairExperimentOfficialSummary['perArm'];
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
      classificationAgreement = rateMetric(answers.map((record) => {
        const item = input.bank.items.find((candidate) => candidate.itemId === record.itemId);
        return record.contractIntent === (item?.intent ?? null);
      }));
    }
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
  const officialSummary: KonlingFairExperimentOfficialSummary = {
    runId: input.runId,
    experimentVersion: EXPERIMENT_VERSION,
    status: 'complete',
    bank: manifest.bank,
    config: input.config,
    calibers: [...input.calibers],
    perArm,
    generationDeltas,
    caliberDeltas,
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
          writeKonlingFairExperimentScore(runDir, caliber, arm, {
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
      config: snapshot.payload.config,
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
