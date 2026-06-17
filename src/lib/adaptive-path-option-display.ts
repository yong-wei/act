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
  limitations: string[];
}

export interface AdaptivePathOptionDisplay {
  id: string;
  title: string;
  estimatedTime: string;
  resources: Array<{ kind: AdaptivePathResourceKind; label: string }>;
  checkpoints: string;
  readiness: string;
  scenario: string;
  reason: string;
  outcome: string;
  riskNote: string;
  writeOption?: AdaptivePathOptionWriteOption;
}

const resourceLabels: Record<string, { kind: AdaptivePathResourceKind; label: string }> = {
  interactive_lesson: { kind: 'interactive_lesson', label: '互动课程' },
  knowledge_card: { kind: 'knowledge_card', label: '知识卡' },
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
): AdaptivePathOptionDisplay[] {
  if (pathOptions.length === 0) return adaptiveStarterPathOptions;
  return pathOptions.map((option) => ({
    id: option.optionId,
    title: option.label,
    estimatedTime: formatEstimatedTime(option),
    resources: buildResourceDisplays(option.resourceMix),
    checkpoints: formatCheckpoints(option),
    readiness: option.limitations.length > 0 ? '需要先处理限制' : '可立即开始',
    scenario: option.evidenceBasis.length > 0
      ? `依据 ${option.evidenceBasis.slice(0, 2).join('、')} 生成。`
      : '按当前学习记录生成。',
    reason: option.targetDeficits.length > 0
      ? `面向 ${option.targetDeficits.length} 个当前薄弱项安排资源。`
      : '按当前学习证据安排资源组合。',
    outcome: option.terminalValidationNodeIds.length > 0
      ? '完成后进入检查节点并更新路径推荐。'
      : '完成后更新后续路径推荐。',
    riskNote: option.limitations[0] ?? '当前没有明显风险提示。',
    writeOption: option,
  }));
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
