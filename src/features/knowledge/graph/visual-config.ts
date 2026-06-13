/**
 * 知识图谱视觉配置
 * 供 2D、3D 图谱组件和图例共用。
 */

// ========== 知识维度颜色 (按 knowledgeDim) ==========
export const KNOWLEDGE_DIM_COLORS: Record<string, string> = {
  FACTUAL: platformToken('platform-chart-2'),
  CONCEPTUAL: platformToken('platform-chart-1'),
  PROCEDURAL: platformToken('platform-chart-5'),
  METACOGNITIVE: platformToken('platform-privacy-private'),
  DEFAULT: platformToken('platform-fg-muted'),
};

// ========== 认知层级辉光颜色 (按 bloomLevel，冷→暖渐变) ==========
export const BLOOM_GLOW_COLORS: Record<string, string> = {
  REMEMBER: platformToken('platform-chart-1'),
  UNDERSTAND: platformToken('platform-chart-2'),
  APPLY: platformToken('platform-replay-ready'),
  ANALYZE: platformToken('platform-evidence-eligible'),
  EVALUATE: platformToken('platform-evaluation-preview'),
  CREATE: platformToken('platform-replay-partial'),
};

export interface RelationStyle {
  color: string;
  colorRgba: string;
  lightColor: string;
  darkColor: string;
  dash: number[];
  width: number;
  hasArrow: boolean;
  endpoint: 'arrow' | 'none' | 'dot' | 'bar' | 'diamond';
  curvature: number;
  opacity: number;
}

export interface RelationThreeDimensionalEncoding {
  arrowLength: number;
  directionalParticles: number;
  particleWidth: number;
  particleSpeed: number;
}

export type RelationDirection = 'directed' | 'undirected' | 'bidirectional';
export type RelationDensityPolicy = 'structure' | 'context' | 'optional' | 'weak';

export interface RelationSemantic {
  type: string;
  label: string;
  visualFamily: string;
  direction: RelationDirection;
  density: RelationDensityPolicy;
  legendExplanation: string;
}

export interface RelationLegendItem extends RelationSemantic {
  sampleStyle: RelationStyle;
}

export interface NodeTypeConfig {
  shape: 'circle' | 'square' | 'hexagon';
  label: string;
  legendColor: string;
}

export const KNOWLEDGE_NODE_SCALE_CONTRACT = {
  minRadius: 4.5,
  maxRadius: 10,
  focusRadiusGain: 1.22,
  focusMaxRadius: 12,
  degreeCap: 24,
  classes: ['knowledge-node-scale-supporting', 'knowledge-node-scale-standard', 'knowledge-node-scale-core'],
} as const;

export interface KnowledgeNodeScaleInput {
  metadata?: Record<string, unknown> | null;
  degree?: number | null;
  focused?: boolean;
}

export interface KnowledgeNodeScale {
  radius: number;
  glowRadius: number;
  scaleClass: string;
}

export const KNOWLEDGE_GRAPH_FILTER_LABELS: Record<string, string> = {
  category: '知识类别',
  bloom_level: '认知层级',
  relation_type: '关系类型',
  density: '关系密度',
  strength: '关系强度',
  connected_nodes: '连通节点',
};

function platformToken(name: string): string {
  return `hsl(var(--${name}))`;
}

function resolvePlatformToken(color: string, alpha: number): string {
  const tokenMatch = /hsl\(var\((--[^)]+)\)\)/.exec(color);
  if (!tokenMatch) return color;
  if (typeof document === 'undefined') {
    return alpha >= 1 ? `hsl(var(${tokenMatch[1]}))` : `hsl(var(${tokenMatch[1]}) / ${alpha})`;
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(tokenMatch[1]).trim();
  if (!value) return alpha >= 1 ? `hsl(var(${tokenMatch[1]}))` : `hsl(var(${tokenMatch[1]}) / ${alpha})`;
  const [hue, saturation, lightness] = value.split(/\s+/);
  if (!hue || !saturation || !lightness) return alpha >= 1 ? `hsl(${value})` : `hsl(${value} / ${alpha})`;
  return alpha >= 1
    ? `hsl(${hue}, ${saturation}, ${lightness})`
    : `hsla(${hue}, ${saturation}, ${lightness}, ${alpha})`;
}

export function hexToRgba(color: string, alpha: number): string {
  if (color.startsWith('hsl(var(')) return resolvePlatformToken(color, alpha);
  if (!color.startsWith('#')) return color;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function relationStyle(style: Omit<RelationStyle, 'colorRgba'>): RelationStyle {
  return {
    ...style,
    colorRgba: hexToRgba(style.color, style.opacity),
  };
}

// ========== 关系类型样式与语义 ==========
export const RELATION_STYLES: Record<string, RelationStyle> = {
  prerequisite: relationStyle({ color: platformToken('platform-chart-4'), lightColor: platformToken('platform-chart-4'), darkColor: platformToken('platform-chart-4'), dash: [], width: 1.6, hasArrow: true, endpoint: 'arrow', curvature: 0.04, opacity: 0.78 }),
  provides_foundation: relationStyle({ color: platformToken('platform-brand-evidence'), lightColor: platformToken('platform-brand-evidence'), darkColor: platformToken('platform-brand-evidence'), dash: [], width: 1.5, hasArrow: true, endpoint: 'arrow', curvature: 0.02, opacity: 0.76 }),
  contains: relationStyle({ color: platformToken('platform-chart-6'), lightColor: platformToken('platform-chart-6'), darkColor: platformToken('platform-chart-6'), dash: [], width: 1.8, hasArrow: false, endpoint: 'dot', curvature: 0, opacity: 0.82 }),
  follows: relationStyle({ color: platformToken('platform-replay-ready'), lightColor: platformToken('platform-replay-ready'), darkColor: platformToken('platform-replay-ready'), dash: [7, 5], width: 1.45, hasArrow: true, endpoint: 'arrow', curvature: 0.08, opacity: 0.7 }),
  leads_to: relationStyle({ color: platformToken('platform-action-primary'), lightColor: platformToken('platform-action-primary'), darkColor: platformToken('platform-action-primary'), dash: [9, 4], width: 1.45, hasArrow: true, endpoint: 'arrow', curvature: 0.1, opacity: 0.72 }),
  applies_to: relationStyle({ color: platformToken('platform-chart-3'), lightColor: platformToken('platform-chart-3'), darkColor: platformToken('platform-chart-3'), dash: [3, 4], width: 1.35, hasArrow: true, endpoint: 'arrow', curvature: 0.06, opacity: 0.68 }),
  opposite: relationStyle({ color: platformToken('platform-evidence-unsupported'), lightColor: platformToken('platform-evidence-unsupported'), darkColor: platformToken('platform-evidence-unsupported'), dash: [2, 4, 8, 4], width: 1.35, hasArrow: false, endpoint: 'bar', curvature: 0.12, opacity: 0.66 }),
  related: relationStyle({ color: platformToken('platform-fg-muted'), lightColor: platformToken('platform-fg-muted'), darkColor: platformToken('platform-fg-muted'), dash: [1, 5], width: 1.05, hasArrow: false, endpoint: 'none', curvature: 0, opacity: 0.45 }),
  cross_domain: relationStyle({ color: platformToken('platform-chart-5'), lightColor: platformToken('platform-chart-5'), darkColor: platformToken('platform-chart-5'), dash: [10, 3, 2, 3], width: 1.35, hasArrow: true, endpoint: 'diamond', curvature: 0.16, opacity: 0.7 }),
  generalizes: relationStyle({ color: platformToken('platform-brand-success'), lightColor: platformToken('platform-brand-success'), darkColor: platformToken('platform-brand-success'), dash: [12, 4], width: 1.5, hasArrow: true, endpoint: 'arrow', curvature: -0.08, opacity: 0.72 }),
  instance_of: relationStyle({ color: platformToken('platform-chart-2'), lightColor: platformToken('platform-chart-2'), darkColor: platformToken('platform-chart-2'), dash: [3, 3, 8, 3], width: 1.3, hasArrow: true, endpoint: 'dot', curvature: -0.04, opacity: 0.68 }),
  supports: relationStyle({ color: platformToken('platform-evidence-eligible'), lightColor: platformToken('platform-evidence-eligible'), darkColor: platformToken('platform-evidence-eligible'), dash: [2, 3], width: 1.25, hasArrow: true, endpoint: 'arrow', curvature: 0.06, opacity: 0.64 }),
  enables: relationStyle({ color: platformToken('platform-replay-partial'), lightColor: platformToken('platform-replay-partial'), darkColor: platformToken('platform-replay-partial'), dash: [4, 2, 2, 2], width: 1.35, hasArrow: true, endpoint: 'arrow', curvature: 0.14, opacity: 0.7 }),
  complements: relationStyle({ color: platformToken('platform-privacy-private'), lightColor: platformToken('platform-privacy-private'), darkColor: platformToken('platform-privacy-private'), dash: [4, 3], width: 1.2, hasArrow: false, endpoint: 'diamond', curvature: 0.08, opacity: 0.62 }),
  contrasts_with: relationStyle({ color: platformToken('platform-brand-danger'), lightColor: platformToken('platform-brand-danger'), darkColor: platformToken('platform-brand-danger'), dash: [2, 3, 2, 6], width: 1.3, hasArrow: false, endpoint: 'bar', curvature: 0.12, opacity: 0.66 }),
  derives: relationStyle({ color: platformToken('platform-chart-6'), lightColor: platformToken('platform-chart-6'), darkColor: platformToken('platform-chart-6'), dash: [6, 2], width: 1.4, hasArrow: true, endpoint: 'arrow', curvature: 0.04, opacity: 0.7 }),
  describes_migration_of: relationStyle({ color: platformToken('platform-evaluation-official'), lightColor: platformToken('platform-evaluation-official'), darkColor: platformToken('platform-evaluation-official'), dash: [8, 2, 2, 2], width: 1.25, hasArrow: true, endpoint: 'arrow', curvature: 0.18, opacity: 0.66 }),
  determines: relationStyle({ color: platformToken('platform-evidence-context'), lightColor: platformToken('platform-evidence-context'), darkColor: platformToken('platform-evidence-context'), dash: [1, 3], width: 1.35, hasArrow: true, endpoint: 'arrow', curvature: 0.05, opacity: 0.68 }),
  embodies: relationStyle({ color: platformToken('platform-evaluation-preview'), lightColor: platformToken('platform-evaluation-preview'), darkColor: platformToken('platform-evaluation-preview'), dash: [5, 2], width: 1.45, hasArrow: false, endpoint: 'dot', curvature: -0.02, opacity: 0.68 }),
  informs: relationStyle({ color: platformToken('platform-privacy-restricted'), lightColor: platformToken('platform-privacy-restricted'), darkColor: platformToken('platform-privacy-restricted'), dash: [2, 5], width: 1.2, hasArrow: true, endpoint: 'arrow', curvature: 0.1, opacity: 0.58 }),
  quantified_by: relationStyle({ color: platformToken('platform-brand-trace-accent'), lightColor: platformToken('platform-brand-trace-accent'), darkColor: platformToken('platform-brand-trace-accent'), dash: [1, 2, 6, 2], width: 1.25, hasArrow: true, endpoint: 'dot', curvature: -0.06, opacity: 0.64 }),
  uses: relationStyle({ color: platformToken('platform-chart-3'), lightColor: platformToken('platform-chart-3'), darkColor: platformToken('platform-chart-3'), dash: [5, 3], width: 1.25, hasArrow: true, endpoint: 'arrow', curvature: 0.07, opacity: 0.64 }),
  visualized_by: relationStyle({ color: platformToken('platform-chart-2'), lightColor: platformToken('platform-chart-2'), darkColor: platformToken('platform-chart-2'), dash: [1, 4, 5, 4], width: 1.2, hasArrow: true, endpoint: 'diamond', curvature: -0.1, opacity: 0.62 }),
};

export const RELATION_SEMANTICS: Record<string, RelationSemantic> = {
  prerequisite: { type: 'prerequisite', label: '前置基础', visualFamily: 'foundation-solid-arrow', direction: 'directed', density: 'structure', legendExplanation: '学习前需要先掌握的基础关系。' },
  provides_foundation: { type: 'provides_foundation', label: '提供基础', visualFamily: 'foundation-solid-arrow', direction: 'directed', density: 'structure', legendExplanation: '为后续概念提供理论或方法基础。' },
  contains: { type: 'contains', label: '章节包含', visualFamily: 'structural-solid-dot', direction: 'undirected', density: 'structure', legendExplanation: '章节、主题或概念簇的结构归属。' },
  follows: { type: 'follows', label: '学习后续', visualFamily: 'sequence-long-dash-arrow', direction: 'directed', density: 'structure', legendExplanation: '建议沿着课程顺序继续学习。' },
  leads_to: { type: 'leads_to', label: '引出问题', visualFamily: 'sequence-long-dash-arrow', direction: 'directed', density: 'structure', legendExplanation: '由当前概念自然引出新的分析对象。' },
  applies_to: { type: 'applies_to', label: '方法应用', visualFamily: 'application-short-dash-arrow', direction: 'directed', density: 'context', legendExplanation: '方法、公式或概念可应用到目标对象。' },
  opposite: { type: 'opposite', label: '相反概念', visualFamily: 'contrast-alternating-bar', direction: 'bidirectional', density: 'optional', legendExplanation: '强调概念之间的反向或互斥关系。' },
  related: { type: 'related', label: '弱关联', visualFamily: 'weak-dotted', direction: 'undirected', density: 'weak', legendExplanation: '保留辅助联想，不作为默认骨架。' },
  cross_domain: { type: 'cross_domain', label: '跨域迁移', visualFamily: 'cross-domain-chain-diamond', direction: 'directed', density: 'context', legendExplanation: '把控制概念迁移到其他场景或学科域。' },
  generalizes: { type: 'generalizes', label: '抽象推广', visualFamily: 'generalization-wide-dash', direction: 'directed', density: 'context', legendExplanation: '从具体对象提升到一般规律。' },
  instance_of: { type: 'instance_of', label: '具体实例', visualFamily: 'instance-dot-dash', direction: 'directed', density: 'context', legendExplanation: '说明某个概念是一般规律的实例。' },
  supports: { type: 'supports', label: '证据支撑', visualFamily: 'support-fine-dotted-arrow', direction: 'directed', density: 'optional', legendExplanation: '用事实、公式或实验结果支撑结论。' },
  enables: { type: 'enables', label: '能力启用', visualFamily: 'enablement-pulse-arrow', direction: 'directed', density: 'context', legendExplanation: '掌握当前概念后可以执行目标任务。' },
  complements: { type: 'complements', label: '互补说明', visualFamily: 'complement-diamond-dash', direction: 'bidirectional', density: 'optional', legendExplanation: '两个概念共同补全同一知识面。' },
  contrasts_with: { type: 'contrasts_with', label: '对照比较', visualFamily: 'contrast-alternating-bar', direction: 'bidirectional', density: 'optional', legendExplanation: '通过差异比较帮助辨析概念。' },
  derives: { type: 'derives', label: '推导得到', visualFamily: 'derivation-tight-dash', direction: 'directed', density: 'context', legendExplanation: '由已有模型、公式或条件推导出目标结果。' },
  describes_migration_of: { type: 'describes_migration_of', label: '迁移描述', visualFamily: 'migration-broken-arc', direction: 'directed', density: 'optional', legendExplanation: '描述概念在不同表示或场景中的迁移。' },
  determines: { type: 'determines', label: '决定因素', visualFamily: 'determinant-dot-arrow', direction: 'directed', density: 'context', legendExplanation: '当前因素会决定或约束目标性质。' },
  embodies: { type: 'embodies', label: '体现为', visualFamily: 'embodiment-solid-dot', direction: 'undirected', density: 'context', legendExplanation: '抽象概念在具体对象中体现出来。' },
  informs: { type: 'informs', label: '提示参考', visualFamily: 'informing-light-dots', direction: 'directed', density: 'weak', legendExplanation: '提供理解目标概念的辅助信息。' },
  quantified_by: { type: 'quantified_by', label: '量化指标', visualFamily: 'measurement-dot-chain', direction: 'directed', density: 'context', legendExplanation: '用指标、参数或图形量化目标概念。' },
  uses: { type: 'uses', label: '使用工具', visualFamily: 'application-short-dash-arrow', direction: 'directed', density: 'context', legendExplanation: '当前任务或概念使用目标方法、工具或资源。' },
  visualized_by: { type: 'visualized_by', label: '图形呈现', visualFamily: 'visualization-diamond-chain', direction: 'directed', density: 'optional', legendExplanation: '通过图形、曲线或可视化方式呈现概念。' },
};

// ========== 节点类型配置 (按 nodeType) ==========
export const NODE_TYPE_CONFIGS: Record<string, NodeTypeConfig> = {
  THEORY: { shape: 'circle', label: '控制理论', legendColor: platformToken('platform-chart-1') },
  SCENARIO: { shape: 'square', label: '船舶场景', legendColor: platformToken('platform-evaluation-preview') },
  ETHICS: { shape: 'hexagon', label: '伦理决策', legendColor: platformToken('platform-replay-ready') },
};

export function getNodeColor(knowledgeDim?: string | null): string {
  if (!knowledgeDim) return KNOWLEDGE_DIM_COLORS.DEFAULT;
  return KNOWLEDGE_DIM_COLORS[knowledgeDim] ?? KNOWLEDGE_DIM_COLORS.DEFAULT;
}

export function getGlowColor(bloomLevel?: string | null): string | null {
  if (!bloomLevel) return null;
  return BLOOM_GLOW_COLORS[bloomLevel] ?? null;
}

export function getRelationSemantic(relation?: string | null): RelationSemantic {
  if (!relation) return RELATION_SEMANTICS.related;
  const semantic = RELATION_SEMANTICS[relation];
  if (!semantic) {
    throw new Error(`Unknown knowledge graph relation type: ${relation}`);
  }
  return semantic;
}

export function getRelationStyle(relation?: string | null): RelationStyle {
  if (!relation) return RELATION_STYLES.related;
  const style = RELATION_STYLES[relation];
  if (!style) {
    throw new Error(`Unknown knowledge graph relation type: ${relation}`);
  }
  return style;
}

export function assertRuntimeRelationStyleCoverage(relationTypes: string[]): string[] {
  return Array.from(new Set(relationTypes)).filter(
    (relationType) => !RELATION_STYLES[relationType] || !RELATION_SEMANTICS[relationType]
  ).sort();
}

export function getRelationLegendItems(): RelationLegendItem[] {
  return Object.keys(RELATION_SEMANTICS).map((type) => ({
    ...RELATION_SEMANTICS[type],
    sampleStyle: getRelationStyle(type),
  }));
}

export function getGraphFilterLabel(field: string): string {
  return KNOWLEDGE_GRAPH_FILTER_LABELS[field] ?? field;
}

function getTeachingImportanceScore(metadata: Record<string, unknown>): number {
  const rawImportance = metadata.importance ?? metadata.teachingImportance ?? metadata.priority;
  if (typeof rawImportance === 'number') {
    const normalized = rawImportance > 1 && rawImportance <= 5 ? rawImportance / 5 : rawImportance;
    return Math.max(0, Math.min(1, normalized));
  }
  if (typeof rawImportance !== 'string') return 0.46;
  if (['core', '核心', 'essential', 'main'].includes(rawImportance)) return 0.96;
  if (['foundation', '基础', 'important'].includes(rawImportance)) return 0.82;
  if (['supporting', '辅助', 'optional'].includes(rawImportance)) return 0.38;
  return 0.56;
}

export function getKnowledgeNodeScale({
  metadata,
  degree,
  focused,
}: KnowledgeNodeScaleInput): KnowledgeNodeScale {
  const safeMetadata = metadata ?? {};
  const importanceScore = getTeachingImportanceScore(safeMetadata);
  const degreeScore = Math.min(Math.max(degree ?? 0, 0), KNOWLEDGE_NODE_SCALE_CONTRACT.degreeCap)
    / KNOWLEDGE_NODE_SCALE_CONTRACT.degreeCap;
  const score = Math.min(1, importanceScore * 0.82 + degreeScore * 0.18);
  const baseRadius = KNOWLEDGE_NODE_SCALE_CONTRACT.minRadius
    + (KNOWLEDGE_NODE_SCALE_CONTRACT.maxRadius - KNOWLEDGE_NODE_SCALE_CONTRACT.minRadius) * score;
  const radius = focused
    ? Math.min(KNOWLEDGE_NODE_SCALE_CONTRACT.focusMaxRadius, baseRadius * KNOWLEDGE_NODE_SCALE_CONTRACT.focusRadiusGain)
    : baseRadius;
  const scaleClass = score >= 0.76
    ? 'knowledge-node-scale-core'
    : score >= 0.54
      ? 'knowledge-node-scale-standard'
      : 'knowledge-node-scale-supporting';

  return {
    radius,
    glowRadius: radius * (focused ? 2.55 : 2.2),
    scaleClass,
  };
}

export function getRelationThreeDimensionalEncoding(
  relation?: string | null
): RelationThreeDimensionalEncoding {
  const style = getRelationStyle(relation);
  const semantic = getRelationSemantic(relation);

  if (semantic.density === 'weak') {
    return {
      arrowLength: style.hasArrow ? 2.4 : 0,
      directionalParticles: style.hasArrow ? 1 : 0,
      particleWidth: Math.max(0.7, style.width * 0.55),
      particleSpeed: style.hasArrow ? 0.0016 : 0,
    };
  }

  if (semantic.direction === 'bidirectional') {
    return {
      arrowLength: 0,
      directionalParticles: 3,
      particleWidth: style.width * 1.1,
      particleSpeed: 0.0018,
    };
  }

  if (semantic.visualFamily.includes('application') || relation === 'enables') {
    return {
      arrowLength: style.hasArrow ? 3.5 : 0,
      directionalParticles: 3,
      particleWidth: style.width * 0.76,
      particleSpeed: 0.003,
    };
  }

  return {
    arrowLength: style.hasArrow ? 4 : 0,
    directionalParticles: style.hasArrow ? 2 : 0,
    particleWidth: Math.max(1, style.width * 0.82),
    particleSpeed: style.hasArrow ? 0.0034 : 0,
  };
}

export function getNodeTypeConfig(nodeType?: string | null): NodeTypeConfig {
  if (!nodeType) return NODE_TYPE_CONFIGS.THEORY;
  return NODE_TYPE_CONFIGS[nodeType] ?? NODE_TYPE_CONFIGS.THEORY;
}
