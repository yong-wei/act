import fs from 'node:fs';
import path from 'node:path';

import { derivedSeed, mulberry32 } from './metrics';
import type {
  KonlingFairExperimentBank,
  KonlingFairExperimentGradedVerdictName,
  KonlingFairExperimentOfficialSummary,
} from './types';
import { KONLING_FAIR_EXPERIMENT_GRADED_VERDICTS } from './types';

/**
 * 教师双人独立复核校准子集（#1952）。
 *
 * 抽样确定性：对每个意图用 config.sampling.seed 派生独立随机流，
 * 从该意图的题库条目（题库顺序）中取 1 条；同题库同种子恒等。
 * 复核记录是人工离线产物：缺失或不可读一律报告 pending，
 * 不阻塞正式摘要，分歧不自动裁决。
 */

export const KONLING_FAIR_EXPERT_REVIEW_RECORDS_RELATIVE_PATH = path.join('expert-review', 'records.json');

export interface KonlingFairExpertReviewRecordEntry {
  itemId: string;
  reviewerA: KonlingFairExperimentGradedVerdictName;
  reviewerB: KonlingFairExperimentGradedVerdictName;
  notes?: string;
}

/** 每意图 1 条的确定性分层抽样清单（按意图首次出现顺序）。 */
export function selectKonlingFairExperimentExpertSubset(input: {
  bank: KonlingFairExperimentBank;
  seed: number;
}): string[] {
  const subset: string[] = [];
  const seenIntents = new Set<string>();
  for (const item of input.bank.items) {
    if (seenIntents.has(item.intent)) continue;
    seenIntents.add(item.intent);
    const candidates = input.bank.items.filter((candidate) => candidate.intent === item.intent);
    const random = mulberry32(derivedSeed(String(input.seed), 'expert-review', item.intent));
    subset.push(candidates[Math.floor(random() * candidates.length)].itemId);
  }
  return subset;
}

function isValidVerdict(value: unknown): value is KonlingFairExperimentGradedVerdictName {
  return (KONLING_FAIR_EXPERIMENT_GRADED_VERDICTS as readonly string[]).includes(String(value));
}

/**
 * 读取双人复核记录并组装报告：仅接受清单内 itemId 且双方 verdict 合法
 * 的条目；不可读文件、零有效条目 → pending（agreementProportion null）。
 */
export function buildKonlingFairExperimentExpertReviewReport(input: {
  runDir: string;
  subsetItemIds: readonly string[];
}): KonlingFairExperimentOfficialSummary['expertReview'] {
  const pending: KonlingFairExperimentOfficialSummary['expertReview'] = {
    status: 'pending',
    subsetItemIds: [...input.subsetItemIds],
    agreementProportion: null,
    disagreements: [],
  };
  const recordsPath = path.join(input.runDir, KONLING_FAIR_EXPERT_REVIEW_RECORDS_RELATIVE_PATH);
  if (!fs.existsSync(recordsPath)) return pending;
  let entries: unknown;
  try {
    const parsed = JSON.parse(fs.readFileSync(recordsPath, 'utf8')) as { records?: unknown };
    entries = Array.isArray(parsed.records) ? parsed.records : null;
  } catch {
    return pending;
  }
  if (!entries) return pending;

  const subset = new Set(input.subsetItemIds);
  const isValidEntry = (entry: unknown): entry is KonlingFairExpertReviewRecordEntry => {
    if (typeof entry !== 'object' || entry === null) return false;
    const record = entry as { itemId?: unknown; reviewerA?: unknown; reviewerB?: unknown };
    return typeof record.itemId === 'string' && subset.has(record.itemId)
      && isValidVerdict(record.reviewerA) && isValidVerdict(record.reviewerB);
  };
  // 每题只计一次（spec：按子集题项形成双人记录）：重复行属人工录入
  // 错误，按文件顺序取首条有效记录，不得对一致率加权。
  const byItem = new Map<string, KonlingFairExpertReviewRecordEntry>();
  for (const entry of entries as unknown[]) {
    if (isValidEntry(entry) && !byItem.has(entry.itemId)) byItem.set(entry.itemId, entry);
  }
  // 一致率以完整子集为前提（spec scenario：双人判定 exist for the subset）：
  // 题项缺失或记录非法被过滤 → 子集不完整 → pending，不发布部分一致率。
  if (byItem.size < input.subsetItemIds.length) return pending;
  const valid = [...byItem.values()];

  const disagreements = valid
    .filter((entry) => entry.reviewerA !== entry.reviewerB)
    .map((entry) => ({
      itemId: entry.itemId,
      reviewerA: entry.reviewerA,
      reviewerB: entry.reviewerB,
      resolution: 'pending-teacher' as const,
    }));
  const agreed = valid.length - disagreements.length;
  return {
    status: 'reported',
    subsetItemIds: [...input.subsetItemIds],
    agreementProportion: agreed / valid.length,
    disagreements,
  };
}
