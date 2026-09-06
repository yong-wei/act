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
import { exportKonlingFairExperimentArtifacts } from './export';
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
import {
  enforceAnswerUnitCitationCoverage,
  enforceKonlingCitationNumberWhitelist,
  isDirectVerifiedSupportCitation,
} from './citation-whitelist-enforcement';
import { scanKonlingAnswerUnits } from '@/lib/konling-answer-unit-scan';
import { repairUncoveredEvidenceUnits } from '@/lib/konling-evidence-allocation';
import { STUDY_QUESTION_SECTIONS, type StudyQuestionIntent } from '@/lib/konling-study-question-structure';

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
          const { systemPrompt, contractIntent, citationAssembly } = buildKonlingFairExperimentSystemPrompt({
            arm,
            item,
            context: PROMPT_CONTEXT,
            // #2039：full-feature 臂经生产分配模块装配 citationContext
            //（主源/备用逐单元映射），随 task 交给 provider 冻结；基线臂
            // 不传 evidence，保持零引用能力。
            ...(arm === 'full-feature' ? {
              evidence: {
                bankVersion: input.bank.bankVersion,
                sourceRevision: input.config.gitRevision,
              },
            } : {}),
          });
          const startedAt = new Date().toISOString();
          const response = await input.generateProvider({
            arm,
            item,
            replicate,
            systemPrompt,
            userPrompt: buildKonlingFairExperimentUserPrompt(item),
            sampling: input.config.sampling,
            ...(citationAssembly ? {
              citations: citationAssembly.citations,
              evidencePlan: citationAssembly.plan,
            } : {}),
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
            // #2017：正式回答写盘前的两道确定性防线（仅 full-feature，
            // 基线臂无引用功能不适用）。先执行编号白名单校验——未分配
            // 编号删除标记并降级；再按覆盖缺口执行一次有界修复说明。
            let finalAnswer = response.result.answer;
            let finalCitations = response.result.citations;
            let citationRepair: KonlingFairExperimentAnswerRecord['citationRepair'];
            if (arm === 'full-feature' && finalCitations !== undefined) {
              // 引用快照不可得（undefined）时跳过执行：快照缺失≠「未分配
              // 任何引用」，按空白名单改写会把全部合法 [n] 删掉并污染不可
              // 重生成的冻结快照（#1992/#2017 P1）。undefined 时聚合层按
              // citation-audit incomplete fail closed。
              const whitelist = enforceKonlingCitationNumberWhitelist({
                answer: response.result.answer,
                citations: finalCitations,
                // 删除伪编号后对所在断言行原地降级——仅删标记不构成
                // 「按待核验呈现」（#2017 review P1）。
                demoteClaim: (line) => `${line.trimEnd()}[引用缺口：待核验]`,
              });
              finalAnswer = whitelist.body;
              if (whitelist.downgraded) {
                console.warn(
                  `[konling-fair-experiment] citation whitelist downgraded ${taskKey}: ${whitelist.removedMarkers.join(', ')}`,
                );
              }
              // 答案单元覆盖：用与审计同一 scan 口径计算必需/已覆盖数；
              // #2039：存在缺口且分配表有可用来源时先执行一轮有界补证
              //（确定性换源重绑，不调用模型），补证后仍缺失才追加显式
              // 证据缺口说明（不伪造引用）。
              const intent = item.intent as StudyQuestionIntent;
              const directSupportIds = new Set(
                finalCitations.filter(isDirectVerifiedSupportCitation).map((citation) => citation.id),
              );
              const countUncovered = (answer: string) => {
                const scan = scanKonlingAnswerUnits(answer, finalCitations, intent);
                const sections = STUDY_QUESTION_SECTIONS[intent];
                return scan.units.filter((unit) => (
                  unit.substantive
                  && unit.sectionId !== null
                  && sections.some((section) => section.id === unit.sectionId && section.citationPolicy === 'evidence-required')
                  && (unit.bindingCitationIds ?? []).every((id) => !directSupportIds.has(id))
                )).length;
              };
              const uncoveredBefore = countUncovered(finalAnswer);
              if (uncoveredBefore > 0 && citationAssembly) {
                const repair = repairUncoveredEvidenceUnits({
                  answer: finalAnswer,
                  intent,
                  citations: finalCitations,
                  plan: citationAssembly.plan,
                });
                if (repair.repairedUnitCount > 0) {
                  finalAnswer = repair.body;
                }
                const uncoveredAfter = countUncovered(finalAnswer);
                citationRepair = {
                  round: 1,
                  outcome: uncoveredAfter === 0 ? 'repaired' : 'unresolved',
                  repairedUnitCount: repair.repairedUnitCount,
                };
              } else {
                citationRepair = uncoveredBefore === 0
                  ? { round: 0, outcome: 'not-needed', repairedUnitCount: 0 }
                  : { round: 1, outcome: 'unresolved', repairedUnitCount: 0 };
              }
              const scan = scanKonlingAnswerUnits(finalAnswer, finalCitations, intent);
              const sections = STUDY_QUESTION_SECTIONS[intent];
              const requiredUnits = scan.units.filter((unit) => (
                unit.substantive
                && unit.sectionId !== null
                && sections.some((section) => section.id === unit.sectionId && section.citationPolicy === 'evidence-required')
              ));
              // 覆盖口径与审计一致（#2017 review P1）：只认可绑定标记中
              // 存在直接支撑引用的单元；bound 但仅 semantic-score 的引用
              // 不计覆盖，使执行与审计对同一单元判定一致。
              const coveredUnits = requiredUnits.filter((unit) => (
                (unit.bindingCitationIds ?? []).some((id) => directSupportIds.has(id))
              ));
              const coverage = enforceAnswerUnitCitationCoverage({
                answer: finalAnswer,
                requiredUnitCount: requiredUnits.length,
                coveredUnitCount: coveredUnits.length,
                normativeGuidance: contractIntent === 'normative-content' || item.intent === 'normative-content'
                  ? 'verification-required'
                  : null,
              });
              finalAnswer = coverage.body;
            }
            const record: KonlingFairExperimentAnswerRecord = {
              ...meta,
              status: 'completed',
              startedAt,
              finishedAt,
              answer: finalAnswer,
              // #1951：citation 快照与回答同文件冻结，供确定性审计。
              // 基线臂（plain/enhanced）无引用功能，provider 缺省即空快照；
              // full-feature 臂透传——缺 citations 字段＝快照不可得（如
              // live 未接入 citationContext），聚合进入 citation-audit
              // incomplete，不得折叠成空数组伪造零值指标（#1992 review P1）。
              citations: arm === 'full-feature'
                ? finalCitations
                : (response.result.citations ?? []),
              ...(citationRepair ? { citationRepair } : {}),
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

    // #1951：official 真源冻结后立即派生 CSV/工作簿/幻灯片，四载体同源。
    if (aggregate.officialSummary) {
      await exportKonlingFairExperimentArtifacts(runDir, aggregate.officialSummary);
    }

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
