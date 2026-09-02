/**
 * 总体—子群伪冲突的确定性识别（Issue #1872）。
 *
 * 班级总体表现正常与部分学生薄弱的学生范围不同，可以同时成立；
 * 方向不同不构成可核验的跨来源冲突。伪冲突命中的条件（子句粒度）：
 * 单个子句内总体正常、子群薄弱与非否定冲突声明三者齐备；或冲突
 * 声明子句通过「二者/两者/上述」等指代词显式指向前一子句中齐备的
 * 总体—子群组合。报告其他位置的独立真实冲突（如同批学生作业高分、
 * 测评低分）不满足归因条件，不受影响。
 *
 * 生成端据此按可重试模型行为缺陷拦截，历史投影端标注「报告需重新生成」。
 */

const OVERALL_NORMAL_PATTERN = /(班级|全班|整体|总体)[^。；;\n]{0,24}(正常|良好|稳定|符合预期|表现正常)/;
const SUBGROUP_WEAK_PATTERN = /(部分|少数|个别|某些)[^。；;\n]{0,16}(学生|同学)[^。；;\n]{0,24}(薄弱|滞后|落后|未开始|进度偏低|低于)/;
// 与历史投影的冲突措辞判定保持一致（Issue #1755 review）。
export const EVIDENCE_CONFLICT_WORDING_PATTERN = /冲突|矛盾|不一致/;
// 否定连接：否定形态后只允许封闭连接集（存在/构成/是/的/真正/确实）
// 直达冲突词，仅中和该冲突词实例。肯定强调词（无疑/无可置疑/无可
// 否认/不排除等）不落在该结构内，天然构成声明而非否定。
const NEGATED_CONFLICT_PREFIX_PATTERN = /(不(?:存在|构成)?|并非|没有?|毫无?|暂无|并无|无)(?:真正|确实|存在|构成|是|的){0,2}$/;
const AFFIRMING_NEGATION_PATTERN = /(不排除|并非没|不无)[^，,。；;\n]{0,4}$/;
// 指代词：冲突声明子句显式指回前文（含前一子句）的总体—子群组合。
const COMBINATION_REFERENCE_PATTERN = /二者|两者|上述|前述|这(?:两|三)?种|该(?:两|三)?者/;

export interface DiagnosisPseudoConflictSource {
  summary: string;
  limitations: ReadonlyArray<string>;
}

export function splitDiagnosisClauses(text: string): string[] {
  return text.split(/(?<=[。；;])/).map((clause) => clause.trim()).filter(Boolean);
}

/** 子句是否含至少一个未被否定连接修饰的冲突词（供检测与历史投影共用）。 */
export function diagnosisClauseDeclaresConflict(clause: string): boolean {
  for (const match of clause.matchAll(/冲突|矛盾|不一致/g)) {
    const prefix = clause.slice(Math.max(0, (match.index ?? 0) - 10), match.index);
    if (AFFIRMING_NEGATION_PATTERN.test(prefix)) return true;
    if (!NEGATED_CONFLICT_PREFIX_PATTERN.test(prefix)) return true;
  }
  return false;
}

function clauseHasOverallNormal(clause: string): boolean {
  return OVERALL_NORMAL_PATTERN.test(clause);
}

function clauseHasSubgroupWeak(clause: string): boolean {
  return SUBGROUP_WEAK_PATTERN.test(clause);
}

function unitDeclaresPseudoConflict(text: string): boolean {
  const clauses = splitDiagnosisClauses(text);
  for (let index = 0; index < clauses.length; index += 1) {
    const clause = clauses[index];
    if (!diagnosisClauseDeclaresConflict(clause)) continue;
    if (clauseHasOverallNormal(clause) && clauseHasSubgroupWeak(clause)) return true;
    // 跨子句指代：声明子句通过指代词指向前一子句中齐备的总体—子群组合。
    const previous = index > 0 ? clauses[index - 1] : '';
    if (COMBINATION_REFERENCE_PATTERN.test(clause)
      && clauseHasOverallNormal(previous)
      && clauseHasSubgroupWeak(previous)) {
      return true;
    }
  }
  return false;
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
  return units
    .filter((unit) => unitDeclaresPseudoConflict(unit.text))
    .map((unit) => unit.label);
}
