import {
  aggregateKonlingBlindAuditRun,
  konlingBlindAuditManifestHash,
  runKonlingBlindAudit,
  type KonlingBlindAuditProvider,
} from '@/lib/konling-blind-audit';
import { evaluateStudyQuestionStructure, type StudyQuestionScoringCaliber } from '@/lib/konling-study-question-structure';

import {
  buildKonlingFairExperimentDerivedAuditManifest,
  derivedAuditRunId,
  konlingFairExperimentBankHash,
} from './bank';
import {
  buildKonlingFairExperimentPromptContext,
  buildKonlingFairExperimentSystemPrompt,
  buildKonlingFairExperimentUserPrompt,
} from './prompts';
import {
  aggregateKonlingFairExperiment,
  buildKonlingFairExperimentManifestPayload,
  konlingFairExperimentManifestHash,
} from './aggregate';
import {
  appendKonlingFairExperimentFailure,
  assertKonlingFairExperimentLockHeld,
  konlingFairExperimentRunDir,
  listKonlingFairExperimentAnswerKeys,
  listKonlingFairExperimentFailureKeys,
  loadKonlingFairExperimentAnswers,
  loadKonlingFairExperimentScores,
  prepareKonlingFairExperimentRun,
  readKonlingFairExperimentFailure,
  releaseKonlingFairExperimentRun,
  writeKonlingFairExperimentAnswer,
  writeKonlingFairExperimentScore,
} from './store';
import { KONLING_FAIR_EXPERIMENT_ARMS } from './types';
import type {
  KonlingFairExperimentAggregateResult,
  KonlingFairExperimentAnswerRecord,
  KonlingFairExperimentArm,
  KonlingFairExperimentBank,
  KonlingFairExperimentConfig,
  KonlingFairExperimentGenerateProvider,
  KonlingFairExperimentRunSummary,
} from './types';
import { buildKonlingFairExperimentTaskKey } from './types';

export { buildKonlingFairExperimentTaskKey, konlingFairExperimentBankHash };

const PROMPT_CONTEXT = buildKonlingFairExperimentPromptContext();

/**
 * 单一命令运行三臂实验：生成 → 口径评分 →（可选）盲审 → fail-closed 聚合。
 * 每个阶段断点续跑；已完成回答快照永不重新生成（#1900）。
 */
export async function runKonlingFairExperiment(input: {
  root: string;
  runId: string;
  bank: KonlingFairExperimentBank;
  arms?: readonly KonlingFairExperimentArm[];
  config: KonlingFairExperimentConfig;
  calibers: readonly StudyQuestionScoringCaliber[];
  generateProvider: KonlingFairExperimentGenerateProvider;
  auditProvider?: KonlingBlindAuditProvider;
}): Promise<KonlingFairExperimentRunSummary & { aggregate: KonlingFairExperimentAggregateResult }> {
  const arms: readonly KonlingFairExperimentArm[] = input.arms
    ?? ['plain-baseline', 'enhanced-baseline', 'full-feature'];
  // 公平实验的正式产物只允许恰好三个标准臂（spec: exactly three arms）；
  // 缺臂/重复臂的数据不得被标记为正式公平实验。
  const uniqueArms = new Set(arms);
  if (arms.length !== KONLING_FAIR_EXPERIMENT_ARMS.length
    || uniqueArms.size !== arms.length
    || !KONLING_FAIR_EXPERIMENT_ARMS.every((arm) => uniqueArms.has(arm))) {
    throw new Error(
      `fair experiment requires exactly the three standard arms: ${KONLING_FAIR_EXPERIMENT_ARMS.join(', ')}`,
    );
  }
  const manifestPayload = buildKonlingFairExperimentManifestPayload({
    bank: input.bank,
    arms,
    config: input.config,
  });
  const runDir = prepareKonlingFairExperimentRun({
    root: input.root,
    runId: input.runId,
    manifestHash: konlingFairExperimentManifestHash(manifestPayload),
    manifestPayload,
  });

  try {
    const generation: KonlingFairExperimentRunSummary['generation'] = {} as KonlingFairExperimentRunSummary['generation'];

    for (const arm of arms) {
      const completedBefore = new Set(listKonlingFairExperimentAnswerKeys(runDir, arm));
      const failedBefore = new Map<string, number>();
      for (const failureKey of listKonlingFairExperimentFailureKeys(runDir, arm)) {
        const failure = readKonlingFairExperimentFailure(runDir, arm, failureKey);
        failedBefore.set(failureKey, failure?.attempts.length ?? 0);
      }

      const expected = input.bank.items.length * input.bank.replicates;
      let completedThisRun = 0;
      let failed = 0;

      for (let replicate = 1; replicate <= input.bank.replicates; replicate += 1) {
        for (const item of input.bank.items) {
          const taskKey = buildKonlingFairExperimentTaskKey({
            bankVersion: input.bank.bankVersion,
            arm,
            itemId: item.itemId,
            replicate,
          });
          if (completedBefore.has(taskKey)) continue;
          const priorAttempts = failedBefore.get(taskKey);
          // 累计 attempt 超过一次的失败项不再自动重试，留待人工裁决（继承 #1820）。
          if (priorAttempts !== undefined && priorAttempts > 1) continue;

          // 外部计费调用前确认锁仍归属本进程：并发接管移走锁时主动终止。
          assertKonlingFairExperimentLockHeld(runDir);
          const { systemPrompt, contractIntent } = buildKonlingFairExperimentSystemPrompt({
            arm,
            item,
            context: PROMPT_CONTEXT,
          });
          const startedAt = new Date().toISOString();
          const response = await input.generateProvider({
            arm,
            item,
            replicate,
            systemPrompt,
            userPrompt: buildKonlingFairExperimentUserPrompt(item),
            sampling: input.config.sampling,
          });
          const finishedAt = new Date().toISOString();
          const meta = {
            taskKey,
            arm,
            bankVersion: input.bank.bankVersion,
            itemId: item.itemId,
            replicate,
            model: input.config.model,
            provider: input.config.provider,
            sampling: input.config.sampling,
            promptVersion: input.config.armPromptVersions[arm],
            gitRevision: input.config.gitRevision,
          };
          if (response.ok) {
            const record: KonlingFairExperimentAnswerRecord = {
              ...meta,
              status: 'completed',
              startedAt,
              finishedAt,
              answer: response.result.answer,
              elapsedMs: response.result.elapsedMs,
              ...(contractIntent ? { contractIntent } : {}),
            };
            writeKonlingFairExperimentAnswer(runDir, arm, record);
            completedThisRun += 1;
          } else {
            appendKonlingFairExperimentFailure(runDir, arm, meta, {
              startedAt,
              finishedAt,
              error: response.error,
            });
            failed += 1;
          }
        }
      }

      const totalCompleted = listKonlingFairExperimentAnswerKeys(runDir, arm).length;
      generation[arm] = {
        expected,
        completedBeforeRun: completedBefore.size,
        completedThisRun,
        failed,
        totalCompleted,
        complete: totalCompleted >= expected,
      };
    }

    // 口径评分：确定性本地计算，对全部冻结快照补齐缺失记录；
    // 评分记录按评分器修订隔离命名空间（跨修订回放互不覆盖）。
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
          writeKonlingFairExperimentScore(runDir, caliber, input.config.scorerRevision, arm, {
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
            gitRevision: input.config.scorerRevision,
          });
        }
      }
    }
    const scoringExpected = input.calibers.length * arms.length
      * input.bank.items.length * input.bank.replicates;
    let scoringTotal = 0;
    for (const caliber of input.calibers) {
      for (const arm of arms) {
        scoringTotal += loadKonlingFairExperimentScores(runDir, caliber, input.config.scorerRevision, arm).length;
      }
    }
    const scoring = {
      calibers: input.calibers,
      scored: scoringTotal,
      complete: scoringTotal >= scoringExpected,
    };

    // 盲审阶段：复用 #1820 断点续跑盲审，被审对象是各臂冻结快照。
    let auditComplete = !input.config.audit.enabled;
    if (input.config.audit.enabled && input.auditProvider) {
      auditComplete = await runAuditPhase({
        root: input.root,
        runId: input.runId,
        bank: input.bank,
        arms,
        config: input.config,
        auditProvider: input.auditProvider,
      });
    }

    const aggregate = aggregateKonlingFairExperiment({
      root: input.root,
      runId: input.runId,
      bank: input.bank,
      arms,
      config: input.config,
      calibers: input.calibers,
      writeOfficial: true,
    });

    return {
      runId: input.runId,
      arms,
      generation,
      scoring,
      audit: { enabled: input.config.audit.enabled, complete: auditComplete },
      aggregateStatus: aggregate.status,
      aggregate,
    };
  } finally {
    releaseKonlingFairExperimentRun(runDir);
  }
}

async function runAuditPhase(input: {
  root: string;
  runId: string;
  bank: KonlingFairExperimentBank;
  arms: readonly KonlingFairExperimentArm[];
  config: KonlingFairExperimentConfig;
  auditProvider: KonlingBlindAuditProvider;
}): Promise<boolean> {
  const runDir = konlingFairExperimentRunDir(input.root, input.runId);
  for (const arm of input.arms) {
    const answers = loadKonlingFairExperimentAnswers(runDir, arm);
    for (let replicate = 1; replicate <= input.bank.replicates; replicate += 1) {
      const replicateAnswers = answers.filter((record) => record.replicate === replicate);
      if (replicateAnswers.length < input.bank.items.length) return false;
      const derivedManifest = buildKonlingFairExperimentDerivedAuditManifest({
        bank: input.bank,
        arm,
        replicate,
        answers: replicateAnswers,
      });
      await runKonlingBlindAudit({
        root: input.root,
        runId: derivedAuditRunId(input.runId, arm, replicate),
        manifest: derivedManifest,
        manifestPayload: derivedManifest,
        manifestHash: konlingBlindAuditManifestHash(derivedManifest),
        mode: 'blind-audit',
        config: {
          mode: 'blind-audit',
          model: input.config.model,
          provider: input.config.provider,
          promptVersion: input.config.audit.promptVersion,
          scoreVersion: input.config.audit.scoreVersion,
          gitRevision: input.config.gitRevision,
        },
        provider: input.auditProvider,
      });
      const aggregate = aggregateKonlingBlindAuditRun({
        root: input.root,
        runId: derivedAuditRunId(input.runId, arm, replicate),
        manifest: derivedManifest,
        mode: 'blind-audit',
      });
      if (aggregate.status !== 'complete') return false;
    }
  }
  return true;
}
