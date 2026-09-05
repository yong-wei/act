import { createHash } from 'node:crypto';

import {
  KONLING_BLIND_AUDIT_BENCHMARK_V1,
  konlingBlindAuditManifestHash,
  type KonlingBlindAuditManifest,
} from '@/lib/konling-blind-audit';

import type {
  KonlingFairExperimentAnswerRecord,
  KonlingFairExperimentArm,
  KonlingFairExperimentBank,
  KonlingFairExperimentBankItem,
} from './types';
import type { StudyQuestionIntent } from '@/lib/konling-study-question-structure';

/**
 * 公平基线实验题库（#1900）：条目复用 #1820 盲审基准的六意图题面，
 * 不新造教学内容；`candidateAnswer` 不参与生成臂，只用作回放对照不敏感
 * 的来源说明。真实批次可以同结构追加条目或提升 replicates。
 */
export const KONLING_FAIR_EXPERIMENT_BANK_V1: KonlingFairExperimentBank = Object.freeze({
  bankVersion: 'fair-experiment-v1',
  replicates: 2,
  items: Object.freeze(KONLING_BLIND_AUDIT_BENCHMARK_V1.items.map((item) => ({
    itemId: item.itemId,
    intent: item.intent as StudyQuestionIntent,
    question: item.question,
    referenceAnswer: item.referenceAnswer,
  }))) as readonly KonlingFairExperimentBankItem[],
} as KonlingFairExperimentBank);

export function konlingFairExperimentBankHash(bank: KonlingFairExperimentBank): string {
  const canonical = JSON.stringify({
    bankVersion: bank.bankVersion,
    replicates: bank.replicates,
    items: bank.items.map((item) => ({
      itemId: item.itemId,
      intent: item.intent,
      question: item.question,
      referenceAnswer: item.referenceAnswer,
      // 分层标注进哈希（#1952）：V1 条目 undefined 字段被 JSON.stringify 丢弃，
      // V1 哈希不变；V2 冻结含分层标注。
      difficulty: item.difficulty,
      topic: item.topic,
      riskType: item.riskType,
    })),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * 派生盲审清单：被审对象是某臂某 replicate 的全部冻结快照。
 * runner 与 aggregate 必须用同一构造，保证 manifest 哈希一致。
 */
export function buildKonlingFairExperimentDerivedAuditManifest(input: {
  bank: KonlingFairExperimentBank;
  arm: KonlingFairExperimentArm;
  replicate: number;
  answers: readonly KonlingFairExperimentAnswerRecord[];
}): KonlingBlindAuditManifest {
  return {
    benchmarkVersion: `${input.bank.bankVersion}--audit--${input.arm}--r${input.replicate}`,
    modes: ['blind-audit'],
    replicates: 1,
    items: input.bank.items.map((bankItem) => ({
      itemId: bankItem.itemId,
      intent: bankItem.intent,
      question: bankItem.question,
      referenceAnswer: bankItem.referenceAnswer,
      candidateAnswer: input.answers.find((record) =>
        record.replicate === input.replicate && record.itemId === bankItem.itemId)?.answer ?? '',
    })),
  };
}

export function derivedAuditRunId(runId: string, arm: KonlingFairExperimentArm, replicate: number): string {
  return `${runId}--audit--${arm}--r${replicate}`;
}

export { konlingBlindAuditManifestHash };
