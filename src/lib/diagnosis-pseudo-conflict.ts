/**
 * 总体—子群伪冲突的确定性识别（Issue #1872）。
 *
 * 班级总体表现正常与部分学生薄弱的学生范围不同，可以同时成立；
 * 方向不同不构成可核验的跨来源冲突。报告同时包含该组合并声明冲突
 * 语义时，属于伪冲突：生成端按可重试模型行为缺陷拦截，历史投影端
 * 标注「报告需重新生成」。
 */

const OVERALL_NORMAL_PATTERN = /(班级|全班|整体|总体)[^。；;\n]{0,24}(正常|良好|稳定|符合预期|表现正常)/;
const SUBGROUP_WEAK_PATTERN = /(部分|少数|个别|某些)[^。；;\n]{0,16}(学生|同学)[^。；;\n]{0,24}(薄弱|滞后|落后|未开始|进度偏低|低于)/;
// 与历史投影的冲突措辞判定保持一致（Issue #1755 review）。
export const EVIDENCE_CONFLICT_WORDING_PATTERN = /冲突|矛盾|不一致/;

export interface DiagnosisPseudoConflictSource {
  summary: string;
  limitations: ReadonlyArray<string>;
}

function overallNormalPresent(texts: readonly string[]): boolean {
  return texts.some((text) => OVERALL_NORMAL_PATTERN.test(text));
}

function subgroupWeakPresent(texts: readonly string[]): boolean {
  return texts.some((text) => SUBGROUP_WEAK_PATTERN.test(text));
}

/**
 * 报告是否把「总体正常 + 子群薄弱」组合声明为证据冲突。
 * 返回命中的字段位置（'summary' / 'limitations[n]'）；空数组表示无伪冲突。
 */
export function detectOverallSubgroupPseudoConflict(source: DiagnosisPseudoConflictSource): string[] {
  const texts = [source.summary, ...source.limitations];
  if (!overallNormalPresent(texts) || !subgroupWeakPresent(texts)) return [];
  const conflictDeclared = source.limitations.some(
    (limitation) => EVIDENCE_CONFLICT_WORDING_PATTERN.test(limitation),
  );
  if (!conflictDeclared) return [];
  const hits: string[] = [];
  if (OVERALL_NORMAL_PATTERN.test(source.summary) || SUBGROUP_WEAK_PATTERN.test(source.summary)) {
    hits.push('summary');
  }
  source.limitations.forEach((limitation, index) => {
    if (OVERALL_NORMAL_PATTERN.test(limitation) || SUBGROUP_WEAK_PATTERN.test(limitation)) {
      hits.push(`limitations[${index}]`);
    }
  });
  return hits.length > 0 ? hits : ['limitations'];
}
