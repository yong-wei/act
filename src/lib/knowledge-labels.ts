/**
 * 知识图谱标签中文映射
 */

import { getKnowledgeGraphRelationContract } from '@/features/knowledge/graph/relation-contract';

// Bloom 认知层级
export const BLOOM_LEVEL_LABELS: Record<string, string> = {
  REMEMBER: '记忆',
  UNDERSTAND: '理解',
  APPLY: '应用',
  ANALYZE: '分析',
  EVALUATE: '评价',
  CREATE: '创造',
};

// 知识维度
export const KNOWLEDGE_DIMENSION_LABELS: Record<string, string> = {
  FACTUAL: '事实性',
  CONCEPTUAL: '概念性',
  PROCEDURAL: '程序性',
  METACOGNITIVE: '元认知',
};

// 节点类型
export const NODE_TYPE_LABELS: Record<string, string> = {
  THEORY: '控制理论',
  SCENARIO: '船舶场景',
  ETHICS: '伦理决策',
};

// 知识关系类型
export const RELATION_TYPE_LABELS: Record<string, string> = {
  prerequisite: '前置基础',
  provides_foundation: '提供基础',
  follows: '学习后续',
  related: '弱关联',
  contains: '包含/隶属',
  leads_to: '引出问题',
  applies_to: '方法应用',
  opposite: '相反概念',
  cross_domain: '跨域迁移',
  generalizes: '抽象推广',
  instance_of: '具体实例',
  supports: '证据支撑',
  enables: '能力启用',
  complements: '互补说明',
  contrasts_with: '对照比较',
  derives: '推导得到',
  derived_from: '推导自',
  part_of: '组成部分',
  describes_migration_of: '迁移描述',
  determines: '决定因素',
  embodies: '体现为',
  informs: '提示参考',
  quantified_by: '量化指标',
  uses: '使用工具',
  visualized_by: '图形呈现',
  causes: '因果作用',
  demonstrates: '示范说明',
  equivalent_to: '条件等价',
  exemplifies: '举例说明',
  extends: '概念扩展',
  has_stage: '过程阶段',
  precedes: '演化先后',
  produces: '产生结果',
  provides_context: '提供语境',
  refined_by: '被精化',
  refines: '精化概念',
  association: '语义关联',
  influences: '影响',
  defines: '定义',
  implements: '实现',
  governs: '约束',
};

// 章节显示顺序（用于知识图谱默认分组与筛选）
export const CHAPTER_DISPLAY_ORDER = [
  '基本概念',
  '系统模型',
  '时域分析',
  '根轨迹分析',
  '频域分析',
  '系统校正',
  '离散系统',
  '非线性系统',
  '状态空间',
] as const;

const CHAPTER_NAME_BY_NUMBER: Record<number, (typeof CHAPTER_DISPLAY_ORDER)[number]> = {
  1: '基本概念',
  2: '系统模型',
  3: '时域分析',
  4: '根轨迹分析',
  5: '频域分析',
  6: '系统校正',
  7: '离散系统',
  8: '非线性系统',
  9: '状态空间',
  // 历史数据中第10章（最优控制相关）并入“状态空间”展示域。
  10: '状态空间',
};

// 获取 Bloom 认知层级标签
export function getBloomLabel(level?: string | null) {
  if (!level) return '';
  return BLOOM_LEVEL_LABELS[level] ?? level;
}

// 获取知识维度标签
export function getKnowledgeDimLabel(dim?: string | null) {
  if (!dim) return '';
  return KNOWLEDGE_DIMENSION_LABELS[dim] ?? dim;
}

// 获取节点类型标签
export function getNodeTypeLabel(type?: string | null) {
  if (!type) return '';
  return NODE_TYPE_LABELS[type] ?? type;
}

// 获取关系类型标签
export function getRelationLabel(relation?: string | null) {
  const contract = getKnowledgeGraphRelationContract(relation);
  if (!contract) {
    throw new Error(`Unknown knowledge graph relation type: ${String(relation ?? '')}`);
  }
  return RELATION_TYPE_LABELS[contract.canonicalType];
}

export function resolveChapterName(chapter?: number, chapterName?: string | null): string {
  if (chapterName && chapterName.trim()) return chapterName.trim();
  if (typeof chapter === 'number') return CHAPTER_NAME_BY_NUMBER[chapter] ?? `第${chapter}章`;
  return '未分章';
}
