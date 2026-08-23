import {
  buildAdaptivePathUnlockChain,
  type AdaptivePathUnlockChain,
  type AdaptivePathUnlockChainNodeInput,
} from '@/lib/adaptive-path-unlock-chain';
import type { AdaptiveLearningPathRecommendationProvenance } from './adaptive-learning-path-planner';

export type AdaptivePathResourceKind =
  | 'interactive_lesson'
  | 'knowledge_card'
  | 'adaptive_quiz'
  | 'control_workbench'
  | 'simulation'
  | 'arena_task'
  | 'external_resource'
  | 'reflection'
  | 'checkpoint'
  | 'konling';

export interface AdaptivePathOptionWriteOption {
  optionId: string;
  label: string;
  nodeIds?: string[];
  activeNodeIds?: string[];
  nodeSummaries?: Array<{
    nodeId: string;
    title: string;
    pathNodeType?: string;
    displayName?: string;
    iconKey?: string;
    shapeHint?: string;
    evidenceBehavior?: string;
    evidenceStatus?: string;
    estimatedTimeMinutes?: number;
    status?: string;
  }>;
  lockedNodeIds: string[];
  readinessSummary: Array<{
    nodeId: string;
    state: string;
    message: string;
  }>;
  readinessDetails?: AdaptivePathUnlockChainNodeInput[];
  targetDeficits: Array<Record<string, unknown>>;
  evidenceBasis: string[];
  resourceMix: Record<string, number>;
  effort: {
    estimatedMinutes?: number;
    relative?: string;
  };
  terminalValidationNodeIds: string[];
  terminalValidationStrategy: {
    summary?: string;
  };
  expectedTargetLift?: number;
  limitations: string[];
  recommendationProvenance?: AdaptiveLearningPathRecommendationProvenance;
}

export interface AdaptivePathOptionPreviewNode {
  nodeId: string;
  title: string;
  kind: AdaptivePathResourceKind;
  resourceLabel: string;
  estimatedTime: string;
  statusLabel: string;
  unlockMessage?: string;
  unlockChain?: AdaptivePathUnlockChain;
  comparisonLabel?: '所有方案均包含' | '本方案特有';
}

export interface AdaptivePathOptionDisplay {
  id: string;
  title: string;
  isGenerated: boolean;
  estimatedTime: string;
  resources: Array<{ kind: AdaptivePathResourceKind; label: string }>;
  orderedNodes?: AdaptivePathOptionPreviewNode[];
  checkpoints: string;
  readiness: string;
  scenario: string;
  reason: string;
  outcome: string;
  expectedAbilityImprovement?: string;
  riskNote: string;
  recommendationProvenance?: AdaptiveLearningPathRecommendationProvenance;
  diversityLimited?: boolean;
  writeOption?: AdaptivePathOptionWriteOption;
}

const resourceLabels: Record<string, { kind: AdaptivePathResourceKind; label: string }> = {
  interactive_lesson: { kind: 'interactive_lesson', label: '互动课程' },
  knowledge_card: { kind: 'knowledge_card', label: '知识卡' },
  textbook_section: { kind: 'external_resource', label: '教材节' },
  slides: { kind: 'external_resource', label: '课件' },
  adaptive_quiz: { kind: 'adaptive_quiz', label: '自适应练习' },
  quiz: { kind: 'adaptive_quiz', label: '自适应练习' },
  control_workbench: { kind: 'control_workbench', label: '控制工作台' },
  simulation: { kind: 'simulation', label: '虚拟仿真' },
  arena_task: { kind: 'arena_task', label: 'Arena' },
  external_resource: { kind: 'external_resource', label: '外部资源' },
  reflection: { kind: 'reflection', label: '反思复盘' },
  checkpoint: { kind: 'checkpoint', label: '检查点' },
  konling: { kind: 'konling', label: '控灵辅导' },
};

export const adaptiveStarterPathOptions: AdaptivePathOptionDisplay[] = [
  {
    id: 'foundation',
    title: '基础补弱路径',
    isGenerated: false,
    estimatedTime: '2 小时 40 分',
    resources: [
      { kind: 'knowledge_card', label: '知识卡' },
      { kind: 'interactive_lesson', label: '互动课程' },
      { kind: 'adaptive_quiz', label: '自适应练习' },
      { kind: 'checkpoint', label: '检查点' },
    ],
    checkpoints: '3 个阶段检查',
    readiness: '可立即开始',
    scenario: '先补概念，再进入练习。',
    reason: '当前概念证据较少，适合降低跨度，先建立稳定理解。',
    outcome: '完成后可进入控制工作台或仿真验证。',
    riskNote: '节奏较稳，完成时间较长。',
  },
  {
    id: 'practice-sprint',
    title: '实践冲刺路径',
    isGenerated: false,
    estimatedTime: '1 小时 55 分',
    resources: [
      { kind: 'control_workbench', label: '控制工作台' },
      { kind: 'simulation', label: '虚拟仿真' },
      { kind: 'arena_task', label: 'Arena' },
      { kind: 'konling', label: '控灵辅导' },
    ],
    checkpoints: '2 个任务检查',
    readiness: '需要持续练习证据',
    scenario: '已有基础，需要快速完成任务验证。',
    reason: '练习表现较稳定，可以用实验和挑战暴露真实薄弱点。',
    outcome: '形成可复盘的设计记录和挑战反馈。',
    riskNote: '挑战密度较高，适合已有基础时选择。',
  },
  {
    id: 'course-sync',
    title: '课程同步路径',
    isGenerated: false,
    estimatedTime: '3 小时 10 分',
    resources: [
      { kind: 'interactive_lesson', label: '互动课程' },
      { kind: 'adaptive_quiz', label: '自适应练习' },
      { kind: 'external_resource', label: '外部资源' },
      { kind: 'reflection', label: '反思复盘' },
    ],
    checkpoints: '4 个同步检查',
    readiness: '可按课堂节奏开始',
    scenario: '跟随课堂节奏，保持连续学习。',
    reason: '这条路径更适合把课堂内容、练习和复盘串联起来。',
    outcome: '形成本周可继续执行的学习计划。',
    riskNote: '外部资料需要按治理来源访问。',
  },
];

export function buildAdaptivePathOptionDisplays(
  pathOptions: AdaptivePathOptionWriteOption[],
  context: { diversityLimited?: boolean } = {},
): AdaptivePathOptionDisplay[] {
  if (pathOptions.length === 0) return adaptiveStarterPathOptions;
  const nodeOccurrences = buildNodeOccurrences(pathOptions);
  return pathOptions.map((option) => ({
    id: option.optionId,
    title: option.label,
    isGenerated: true,
    estimatedTime: formatEstimatedTime(option),
    resources: buildResourceDisplays(option.resourceMix),
    orderedNodes: buildOrderedNodes(option, nodeOccurrences, pathOptions.length),
    checkpoints: formatCheckpoints(option),
    readiness: formatReadiness(option),
    scenario: formatScenario(option.evidenceBasis, option.recommendationProvenance?.confidence),
    reason: option.targetDeficits.length > 0
      ? `面向 ${option.targetDeficits.length} 个当前薄弱项安排资源。`
      : '按当前学习证据安排资源组合。',
    outcome: option.terminalValidationNodeIds.length > 0
      ? '完成后进入检查节点并更新路径推荐。'
      : '完成后更新后续路径推荐。',
    expectedAbilityImprovement: formatExpectedAbilityImprovement(option.expectedTargetLift),
    riskNote: option.limitations[0] ?? '当前没有明显风险提示。',
    recommendationProvenance: option.recommendationProvenance,
    diversityLimited: context.diversityLimited,
    writeOption: option,
  }));
}

function formatScenario(
  evidenceBasis: string[],
  provenanceConfidence?: AdaptiveLearningPathRecommendationProvenance['confidence'],
): string {
  if (provenanceConfidence === 'low') {
    return '当前学习记录较少，这条路径会先从基础内容开始。';
  }

  if (evidenceBasis.some((source) => [
    'low-confidence-learner-state',
    '当前证据较少，路径会从基础资源开始。',
    '当前证据较少',
    '证据较少',
  ].includes(source))) {
    return '当前学习记录较少，这条路径会先从基础内容开始。';
  }

  if (evidenceBasis.some((source) => [
    'adaptive-learner-state',
    'LearningFact',
    '学习证据',
    '练习记录',
    '路径已结合你的近期学习证据。',
  ].includes(source))) {
    return '这条路径结合你的学习记录生成。';
  }

  return '这条路径根据当前学习记录生成。';
}

function buildNodeOccurrences(pathOptions: AdaptivePathOptionWriteOption[]): Map<string, number> {
  const occurrences = new Map<string, number>();
  for (const option of pathOptions) {
    for (const nodeId of new Set(option.nodeIds ?? [])) {
      occurrences.set(nodeId, (occurrences.get(nodeId) ?? 0) + 1);
    }
  }
  return occurrences;
}

function buildOrderedNodes(
  option: AdaptivePathOptionWriteOption,
  nodeOccurrences: Map<string, number>,
  optionCount: number,
): AdaptivePathOptionPreviewNode[] | undefined {
  const nodeIds = option.nodeIds ?? [];
  if (nodeIds.length === 0 || !option.nodeSummaries?.length) return undefined;
  const nodeSummaries = option.nodeSummaries;
  const summaries = new Map(nodeSummaries.map((summary) => [summary.nodeId, summary]));
  const readiness = new Map(option.readinessSummary.map((item) => [item.nodeId, item]));
  const nodes = nodeIds.map<AdaptivePathOptionPreviewNode | null>((nodeId) => {
    const summary = summaries.get(nodeId);
    const title = summary?.title || summary?.displayName;
    if (!summary || !title) return null;
    const readinessItem = readiness.get(nodeId);
    const isLocked = option.lockedNodeIds.includes(nodeId)
      || summary.status === 'locked'
      || readinessItem?.state === 'locked';
    const readinessDetail = option.readinessDetails?.find((item) => item.nodeId === nodeId);
    return {
      nodeId,
      title,
      ...resourceDisplayForNode(summary.pathNodeType, summary.displayName),
      estimatedTime: formatNodeEstimatedTime(summary.estimatedTimeMinutes),
      statusLabel: formatNodeStatus(summary.status, readinessItem?.state, isLocked),
      unlockMessage: isLocked || readinessItem?.state !== 'ready' ? readinessItem?.message || undefined : undefined,
      unlockChain: isLocked && readinessDetail
        ? buildAdaptivePathUnlockChain(
            readinessDetail,
            option.readinessDetails?.map((item) => ({
              nodeId: item.nodeId,
              title: item.title,
              type: item.type ?? nodeSummaries.find((summary) => summary.nodeId === item.nodeId)?.pathNodeType,
              status: item.status ?? nodeSummaries.find((summary) => summary.nodeId === item.nodeId)?.status,
            })) ?? nodeSummaries.map((item) => ({ nodeId: item.nodeId, title: item.title })),
          )
        : undefined,
      comparisonLabel: formatComparisonLabel(nodeOccurrences.get(nodeId) ?? 0, optionCount),
    };
  });
  return nodes.every((node): node is AdaptivePathOptionPreviewNode => node !== null) ? nodes : undefined;
}

function resourceDisplayForNode(
  pathNodeType?: string,
  displayName?: string,
): Pick<AdaptivePathOptionPreviewNode, 'kind' | 'resourceLabel'> {
  const resource = pathNodeType ? resourceLabels[pathNodeType] : undefined;
  if (resource) {
    return {
      kind: resource.kind,
      resourceLabel: resource.label,
    };
  }
  return {
    kind: 'external_resource',
    resourceLabel: displayName || pathNodeType?.replaceAll('_', ' ') || '学习节点',
  };
}

function formatNodeEstimatedTime(minutes?: number): string {
  return typeof minutes === 'number' && minutes > 0 ? `预计 ${minutes} 分钟` : '预计时长待确认';
}

function formatNodeStatus(status: string | undefined, readinessState: string | undefined, isLocked: boolean): string {
  if (isLocked) return '稍后解锁';
  if (status === 'completed') return '已完成';
  if (status === 'current') return '建议从这里开始';
  if (status === 'blocked' || readinessState === 'blocked') return '待完成准备';
  if (status === 'next') return '后续安排';
  if (status === 'alternative') return '备选安排';
  if (readinessState && readinessState !== 'ready') return '准备状态待确认';
  return '可纳入此路径';
}

function formatComparisonLabel(
  occurrenceCount: number,
  optionCount: number,
): AdaptivePathOptionPreviewNode['comparisonLabel'] {
  if (optionCount < 2) return undefined;
  if (occurrenceCount === optionCount) return '所有方案均包含';
  if (occurrenceCount === 1) return '本方案特有';
  return undefined;
}

function formatExpectedAbilityImprovement(value?: number): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return `约 +${value.toFixed(value % 1 === 0 ? 0 : 1)}`;
}

function formatEstimatedTime(option: AdaptivePathOptionWriteOption): string {
  if (typeof option.effort.estimatedMinutes === 'number') {
    return `${option.effort.estimatedMinutes} 分钟`;
  }
  if (option.effort.relative === 'short') return '较短';
  if (option.effort.relative === 'medium') return '中等';
  if (option.effort.relative === 'long') return '较长';
  return '时长待确认';
}

function buildResourceDisplays(resourceMix: Record<string, number>): AdaptivePathOptionDisplay['resources'] {
  const resources = Object.entries(resourceMix)
    .filter(([, count]) => count > 0)
    .map(([key]) => resourceLabels[key] ?? { kind: 'checkpoint' as const, label: key.replaceAll('_', ' ') });
  return resources.length > 0 ? resources : [{ kind: 'checkpoint', label: '路径节点' }];
}

function formatCheckpoints(option: AdaptivePathOptionWriteOption): string {
  const count = option.terminalValidationNodeIds.length;
  return count > 0 ? `${count} 个检查节点` : '检查节点待确认';
}

function formatReadiness(option: AdaptivePathOptionWriteOption): string {
  if (option.lockedNodeIds.length > 0) return '包含后续解锁节点';
  if (option.readinessSummary.some((item) => item.state !== 'ready')) return '需要先满足准备条件';
  if (option.limitations.length > 0) return '需要先处理限制';
  return '可立即开始';
}
