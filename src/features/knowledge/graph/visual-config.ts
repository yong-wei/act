/**
 * 知识图谱视觉配置
 * 供 2D 和 3D 图谱组件共用
 */

// ========== 知识维度颜色 (按 knowledgeDim) ==========
export const KNOWLEDGE_DIM_COLORS: Record<string, string> = {
  FACTUAL: '#06b6d4',      // 青色 - 事实性知识
  CONCEPTUAL: '#3b82f6',   // 蓝色 - 概念性知识
  PROCEDURAL: '#8b5cf6',   // 紫色 - 程序性知识
  METACOGNITIVE: '#ec4899', // 粉色 - 元认知知识
  DEFAULT: '#64748b',      // 灰色 - 默认
};

// ========== 认知层级辉光颜色 (按 bloomLevel，冷→暖渐变) ==========
export const BLOOM_GLOW_COLORS: Record<string, string> = {
  REMEMBER: '#60a5fa',    // 冷蓝
  UNDERSTAND: '#38bdf8',  // 天蓝
  APPLY: '#34d399',       // 青绿
  ANALYZE: '#a3e635',     // 黄绿
  EVALUATE: '#fbbf24',    // 琥珀
  CREATE: '#f59e0b',      // 金色
};

// ========== 关系类型样式 (按 relation) ==========
export interface RelationStyle {
  color: string;
  colorRgba: string;
  dash: number[];
  width: number;
  hasArrow: boolean;
}

export interface RelationThreeDimensionalEncoding {
  arrowLength: number;
  directionalParticles: number;
  particleWidth: number;
  particleSpeed: number;
}

export const RELATION_STYLES: Record<string, RelationStyle> = {
  prerequisite: {
    color: '#f59e0b',
    colorRgba: 'rgba(245, 158, 11, 0.7)',
    dash: [],
    width: 2.5,
    hasArrow: true,
  },
  provides_foundation: {
    color: '#f59e0b',
    colorRgba: 'rgba(245, 158, 11, 0.7)',
    dash: [],
    width: 2.5,
    hasArrow: true,
  },
  contains: {
    color: '#fb923c',
    colorRgba: 'rgba(251, 146, 60, 0.7)',
    dash: [],
    width: 3,
    hasArrow: false,
  },
  follows: {
    color: '#10b981',
    colorRgba: 'rgba(16, 185, 129, 0.6)',
    dash: [5, 5],
    width: 2.5,
    hasArrow: true,
  },
  leads_to: {
    color: '#0ea5e9',
    colorRgba: 'rgba(14, 165, 233, 0.65)',
    dash: [6, 3],
    width: 2.4,
    hasArrow: true,
  },
  applies_to: {
    color: '#22c55e',
    colorRgba: 'rgba(34, 197, 94, 0.58)',
    dash: [3, 4],
    width: 2.1,
    hasArrow: true,
  },
  opposite: {
    color: '#f87171',
    colorRgba: 'rgba(248, 113, 113, 0.62)',
    dash: [2, 4],
    width: 2.1,
    hasArrow: false,
  },
  related: {
    color: '#64748b',
    colorRgba: 'rgba(100, 116, 139, 0.5)',
    dash: [3, 4],
    width: 2,
    hasArrow: false,
  },
};

// ========== 节点类型配置 (按 nodeType) ==========
export interface NodeTypeConfig {
  shape: 'circle' | 'square' | 'hexagon';
  label: string;
  legendColor: string;
}

export const NODE_TYPE_CONFIGS: Record<string, NodeTypeConfig> = {
  THEORY: {
    shape: 'circle',
    label: '控制理论',
    legendColor: '#3b82f6',
  },
  SCENARIO: {
    shape: 'square',
    label: '船舶场景',
    legendColor: '#ef4444',
  },
  ETHICS: {
    shape: 'hexagon',
    label: '伦理决策',
    legendColor: '#10b981',
  },
};

// ========== 辅助函数 ==========

/**
 * 根据知识维度获取节点填充颜色
 */
export function getNodeColor(knowledgeDim?: string | null): string {
  if (!knowledgeDim) return KNOWLEDGE_DIM_COLORS.DEFAULT;
  return KNOWLEDGE_DIM_COLORS[knowledgeDim] ?? KNOWLEDGE_DIM_COLORS.DEFAULT;
}

/**
 * 根据认知层级获取辉光颜色
 * 返回 null 表示没有辉光
 */
export function getGlowColor(bloomLevel?: string | null): string | null {
  if (!bloomLevel) return null;
  return BLOOM_GLOW_COLORS[bloomLevel] ?? null;
}

/**
 * 根据关系类型获取连线样式
 */
export function getRelationStyle(relation?: string | null): RelationStyle {
  if (!relation) return RELATION_STYLES.related;
  return RELATION_STYLES[relation] ?? RELATION_STYLES.related;
}

/**
 * 3D 视图没有 dashed line primitive，用方向箭头、粒子数量、粒子宽度和速度补足非颜色编码。
 */
export function getRelationThreeDimensionalEncoding(
  relation?: string | null
): RelationThreeDimensionalEncoding {
  const style = getRelationStyle(relation);

  switch (relation) {
    case 'contains':
      return {
        arrowLength: 0,
        directionalParticles: 0,
        particleWidth: style.width * 0.9,
        particleSpeed: 0,
      };
    case 'opposite':
      return {
        arrowLength: 0,
        directionalParticles: 3,
        particleWidth: style.width * 1.1,
        particleSpeed: 0.0018,
      };
    case 'related':
      return {
        arrowLength: 0,
        directionalParticles: 1,
        particleWidth: style.width * 0.45,
        particleSpeed: 0.0012,
      };
    case 'applies_to':
      return {
        arrowLength: style.hasArrow ? 3.5 : 0,
        directionalParticles: 3,
        particleWidth: style.width * 0.7,
        particleSpeed: 0.003,
      };
    case 'follows':
    case 'leads_to':
      return {
        arrowLength: style.hasArrow ? 4 : 0,
        directionalParticles: 2,
        particleWidth: style.width * 0.75,
        particleSpeed: 0.0036,
      };
    default:
      return {
        arrowLength: style.hasArrow ? 4 : 0,
        directionalParticles: style.hasArrow ? 1 : 0,
        particleWidth: Math.max(1.2, style.width * 0.75),
        particleSpeed: style.hasArrow ? 0.004 : 0,
      };
  }
}

/**
 * 根据节点类型获取形状配置
 */
export function getNodeTypeConfig(nodeType?: string | null): NodeTypeConfig {
  if (!nodeType) return NODE_TYPE_CONFIGS.THEORY;
  return NODE_TYPE_CONFIGS[nodeType] ?? NODE_TYPE_CONFIGS.THEORY;
}

/**
 * 将十六进制颜色转换为带透明度的 rgba
 */
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
