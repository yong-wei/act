/**
 * 总体—子群伪冲突的确定性识别（Issue #1872）。
 *
 * 班级总体表现正常与部分学生薄弱的学生范围不同，可以同时成立；
 * 方向不同不构成可核验的跨来源冲突。伪冲突成立的条件：
 * 1. 报告全文（summary + limitations）同时存在总体正常与子群薄弱表述；
 * 2. 存在未被否定措辞中和的冲突声明，且该声明与总体—子群表述
 *    出现在同一文本单元（summary 或单条 limitation）内——冲突声明
 *    实际指向该组合，而不是报告其他位置的独立真实冲突。
 *
 * 生成端据此按可重试模型行为缺陷拦截，历史投影端标注「报告需重新生成」；
 * 真实可比冲突（同一批学生、相近时间窗、方向相反）不受影响。
 */

const OVERALL_NORMAL_PATTERN = /(班级|全班|整体|总体)[^。；;\n]{0,24}(正常|良好|稳定|符合预期|表现正常)/;
const SUBGROUP_WEAK_PATTERN = /(部分|少数|个别|某些)[^。；;\n]{0,16}(学生|同学)[^。；;\n]{0,24}(薄弱|滞后|落后|未开始|进度偏低|低于)/;
// 与历史投影的冲突措辞判定保持一致（Issue #1755 review）。
export const EVIDENCE_CONFLICT_WORDING_PATTERN = /冲突|矛盾|不一致/;
// 否定措辞把冲突词中和为「不存在冲突」的合规表述，不算冲突声明。
const NEGATED_CONFLICT_PATTERN = /不(?:存在|构成)?[^。；;\n]{0,6}(?:冲突|矛盾|不一致)|并非[^。；;\n]{0,12}(?:冲突|矛盾|不一致)|没有[^。；;\n]{0,12}(?:冲突|矛盾|不一致)/;

export interface DiagnosisPseudoConflictSource {
  summary: string;
  limitations: ReadonlyArray<string>;
}

/**
 * 报告是否把「总体正常 + 子群薄弱」组合声明为证据冲突。
 * 返回命中的字段位置（'summary' / 'limitations[n]'）；空数组表示无伪冲突。
 */
export function detectOverallSubgroupPseudoConflict(source: DiagnosisPseudoConflictSource): string[] {
  const units = [
    { label: 'summary', text: source.summary },
    ...source.limitations.map((text, index) => ({ label: `limitations[${index}]`, text })),
  ];
  const allTexts = units.map((unit) => unit.text);
  const overallPresent = allTexts.some((text) => OVERALL_NORMAL_PATTERN.test(text));
  const subgroupPresent = allTexts.some((text) => SUBGROUP_WEAK_PATTERN.test(text));
  if (!overallPresent || !subgroupPresent) return [];

  const hits: string[] = [];
  for (const unit of units) {
    const declaresConflict = EVIDENCE_CONFLICT_WORDING_PATTERN.test(unit.text)
      && !NEGATED_CONFLICT_PATTERN.test(unit.text);
    if (!declaresConflict) continue;
    // 归因确认：冲突声明必须与总体—子群表述共现在同一单元，避免把
    // 报告其他位置的独立真实冲突（如同批学生作业测评方向相反）归因
    // 给总体—子群组合。
    const boundToCombination = OVERALL_NORMAL_PATTERN.test(unit.text)
      || SUBGROUP_WEAK_PATTERN.test(unit.text);
    if (boundToCombination) hits.push(unit.label);
  }
  return hits;
}
