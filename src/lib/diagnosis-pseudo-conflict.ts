/**
 * 总体—子群伪冲突的确定性识别（Issue #1872）。
 *
 * 班级总体表现正常与部分学生薄弱的学生范围不同，可以同时成立；
 * 方向不同不构成可核验的跨来源冲突。伪冲突成立的条件（子句粒度）：
 * 存在单个子句，其中总体正常表述、子群薄弱表述与未被否定措辞中和
 * 的冲突声明三者齐备——冲突声明明确指向该总体—子群组合。报告其他
 * 子句或单元里的独立真实冲突（如同批学生作业高分、测评低分）不满足
 * 齐备条件，不受影响。
 *
 * 生成端据此按可重试模型行为缺陷拦截，历史投影端标注「报告需重新生成」。
 */

const OVERALL_NORMAL_PATTERN = /(班级|全班|整体|总体)[^。；;\n]{0,24}(正常|良好|稳定|符合预期|表现正常)/;
const SUBGROUP_WEAK_PATTERN = /(部分|少数|个别|某些)[^。；;\n]{0,16}(学生|同学)[^。；;\n]{0,24}(薄弱|滞后|落后|未开始|进度偏低|低于)/;
// 与历史投影的冲突措辞判定保持一致（Issue #1755 review）。
export const EVIDENCE_CONFLICT_WORDING_PATTERN = /冲突|矛盾|不一致/;
// 否定措辞把冲突词中和为「不存在冲突」的合规表述；判定只作用于所在子句。
const NEGATED_CONFLICT_PATTERN = /不(?:存在|构成)?[^。；;\n]{0,6}(?:冲突|矛盾|不一致)|并非[^。；;\n]{0,12}(?:冲突|矛盾|不一致)|没有[^。；;\n]{0,12}(?:冲突|矛盾|不一致)/;

export interface DiagnosisPseudoConflictSource {
  summary: string;
  limitations: ReadonlyArray<string>;
}

function splitClauses(text: string): string[] {
  return text.split(/(?<=[。；;])/).map((clause) => clause.trim()).filter(Boolean);
}

function clauseDeclaresPseudoConflict(clause: string): boolean {
  if (!EVIDENCE_CONFLICT_WORDING_PATTERN.test(clause)) return false;
  if (NEGATED_CONFLICT_PATTERN.test(clause)) return false;
  return OVERALL_NORMAL_PATTERN.test(clause) && SUBGROUP_WEAK_PATTERN.test(clause);
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
  const hits: string[] = [];
  for (const unit of units) {
    if (splitClauses(unit.text).some(clauseDeclaresPseudoConflict)) {
      hits.push(unit.label);
    }
  }
  return hits;
}
