/**
 * 盲审 judge 输出解析（#1900）：语法正确但语义非法的判定（未知 verdict
 * 枚举、越界或非有限 ruleScore）一律视为 parse-failure，不得进入冻结
 * 记录污染正式指标。
 */

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
