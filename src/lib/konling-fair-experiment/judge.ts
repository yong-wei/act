/**
 * 盲审 judge 输出解析（#1900）：语法正确但语义非法的判定（未知 verdict
 * 枚举、越界或非有限 ruleScore）一律视为 parse-failure，不得进入冻结
 * 记录污染正式指标。
 *
 * #1952 增补分级解析器（rubric-graded.v2）：三级 verdict + 五子分，
 * 同样 fail closed；旧二元解析器冻结不动。
 */

import {
  KONLING_FAIR_EXPERIMENT_AUDIT_DIMENSIONS,
  KONLING_FAIR_EXPERIMENT_GRADED_VERDICTS,
  type KonlingFairExperimentGradedVerdict,
} from './types';

export interface KonlingFairExperimentJudgeVerdict {
  verdict: 'pass' | 'needs-improvement' | 'fail';
  ruleScore: number;
  notes: string | null;
}

export function parseKonlingFairExperimentJudgeVerdict(text: string): KonlingFairExperimentJudgeVerdict | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim().replace(/^```(?:json)?|```$/g, ''));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const record = parsed as { verdict?: unknown; ruleScore?: unknown; notes?: unknown };
  if (record.verdict !== 'pass' && record.verdict !== 'needs-improvement' && record.verdict !== 'fail') {
    return null;
  }
  if (typeof record.ruleScore !== 'number' || !Number.isFinite(record.ruleScore)
    || record.ruleScore < 0 || record.ruleScore > 1) {
    return null;
  }
  return {
    verdict: record.verdict,
    ruleScore: record.ruleScore,
    notes: typeof record.notes === 'string' ? record.notes : null,
  };
}

/**
 * 分级盲审判定解析（#1952，rubric-graded.v2）：verdict ∈
 * {correct, minor-flaw, major-error}，五子分各 0-1 有限数值。
 * 未知枚举、缺维度、越界或非有限数值 → null（parse-failure，
 * 沿用 #1900 fail-closed 语义）。
 */
export function parseKonlingFairExperimentGradedVerdict(text: string): KonlingFairExperimentGradedVerdict | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim().replace(/^```(?:json)?|```$/g, ''));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const record = parsed as { verdict?: unknown; ruleScore?: unknown; subscores?: unknown; notes?: unknown };
  if (!(KONLING_FAIR_EXPERIMENT_GRADED_VERDICTS as readonly string[]).includes(String(record.verdict))) {
    return null;
  }
  if (typeof record.ruleScore !== 'number' || !Number.isFinite(record.ruleScore)
    || record.ruleScore < 0 || record.ruleScore > 1) {
    return null;
  }
  if (typeof record.subscores !== 'object' || record.subscores === null) return null;
  const subscores = record.subscores as Record<string, unknown>;
  const gradedSubscores = {} as KonlingFairExperimentGradedVerdict['subscores'];
  for (const dimension of KONLING_FAIR_EXPERIMENT_AUDIT_DIMENSIONS) {
    const value = subscores[dimension];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      return null;
    }
    gradedSubscores[dimension] = value;
  }
  return {
    verdict: record.verdict as KonlingFairExperimentGradedVerdict['verdict'],
    ruleScore: record.ruleScore,
    subscores: gradedSubscores,
    notes: typeof record.notes === 'string' ? record.notes : null,
  };
}
