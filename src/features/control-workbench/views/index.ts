import type {
  WorkbenchPresetId,
  WorkbenchSessionContext,
  WorkbenchViewConfig,
  WorkbenchViewId,
} from '../contracts';

export type WorkbenchViewOptionId =
  | 'reference'
  | 'uncorrected-output'
  | 'corrected-output'
  | 'blackbox-output'
  | 'uncorrected-open-loop'
  | 'corrected-open-loop'
  | 'correction-device'
  | 'uncorrected-root-locus'
  | 'corrected-root-locus'
  | 'nominal-root-locus'
  | 'persisted-experiment-dataset'
  | 'student-nominal-model'
  | 'nominal-model-response'
  | 'virtual-preview-response'
  | 'disturbance-rejection-response'
  | 'control-effort-estimate'
  | 'official-hidden-target'
  | 'leaderboard-official-metrics';

export interface WorkbenchViewAvailability {
  available: boolean;
  reason?: string;
}

export interface WorkbenchViewOption {
  id: WorkbenchViewOptionId;
  label: string;
  enabled: boolean;
  disabledReason?: string;
}

export type WorkbenchEvidenceExplanationKind = 'diagnostic' | 'tradeoff' | 'official-boundary' | 'privacy';

export interface WorkbenchEvidenceExplanation {
  id: string;
  viewId: WorkbenchViewId;
  title: string;
  summary: string;
  evidenceBasis: string[];
  boundary: string;
  kind: WorkbenchEvidenceExplanationKind;
}

export interface WorkbenchViewPlugin {
  id: WorkbenchViewId;
  title: string;
  getAvailability: (session: WorkbenchSessionContext) => WorkbenchViewAvailability;
  getOptions: (session: WorkbenchSessionContext) => WorkbenchViewOption[];
  getExplanations: (
    session: WorkbenchSessionContext,
    panel?: WorkbenchPanelInstance,
  ) => WorkbenchEvidenceExplanation[];
}

export interface WorkbenchPanelInstance {
  id: string;
  viewId: WorkbenchViewId;
  title: string;
  enabled: boolean;
  selectedOptions?: string[];
  signalKinds?: WorkbenchViewConfig['signalKinds'];
  signalSources?: WorkbenchViewConfig['signalSources'];
  settings?: WorkbenchViewConfig['settings'];
}

function hasPublicTransferFunction(session: WorkbenchSessionContext) {
  return Boolean(session.officialTarget && 'transferFunction' in session.officialTarget);
}

function hasNominalModel(session: WorkbenchSessionContext) {
  return Boolean(session.workingModel);
}

function hasModelSource(session: WorkbenchSessionContext) {
  return hasPublicTransferFunction(session) || hasNominalModel(session);
}

function hasClassicalCorrectionSource(session: WorkbenchSessionContext) {
  return session.allowedMethods.includes('serial-compensator') || session.allowedMethods.includes('pid');
}

function hasResponsePreviewControllerSource(session: WorkbenchSessionContext) {
  return hasClassicalCorrectionSource(session)
    || session.allowedMethods.includes('composite-compensation')
    || session.allowedMethods.includes('mpc')
    || session.allowedMethods.includes('optimized-pid');
}

function hasControlEffortSource(session: WorkbenchSessionContext) {
  return session.allowedMethods.includes('composite-compensation')
    || session.allowedMethods.includes('mpc')
    || session.allowedMethods.includes('optimized-pid');
}

function modelAvailability(session: WorkbenchSessionContext): WorkbenchViewAvailability {
  if (hasModelSource(session)) return { available: true };
  return {
    available: false,
    reason: '暂无公开传递函数或名义模型，不能生成该视图。',
  };
}

function enabledOption(id: WorkbenchViewOptionId, label: string): WorkbenchViewOption {
  return { id, label, enabled: true };
}

function disabledOption(
  id: WorkbenchViewOptionId,
  label: string,
  disabledReason: string,
): WorkbenchViewOption {
  return { id, label, enabled: false, disabledReason };
}

function officialBoundary(session: WorkbenchSessionContext): string {
  if (session.submissionPolicy.officialEvaluationEnabled) {
    return '工作台解释只说明预览或诊断证据，官方评价以提交后的 Arena 评测为准。';
  }
  return session.submissionPolicy.disabledReason ?? '当前会话不进入官方评价和榜单。';
}

function modelBasis(session: WorkbenchSessionContext): string {
  if (session.workingModel) return '学生名义模型';
  if (hasPublicTransferFunction(session)) return '公开传递函数模型';
  return '当前会话可见数据';
}

function metricBasis(session: WorkbenchSessionContext): string[] {
  if (!('metricProfile' in session)) return ['本地观察指标'];
  return session.metricProfile.rankingMetrics.slice(0, 4).map((metric) => metric.label);
}

function selectedEnabledOptionLabels(
  viewId: WorkbenchViewId,
  session: WorkbenchSessionContext,
  panel?: WorkbenchPanelInstance,
): string[] {
  const plugin = getWorkbenchViewPlugin(viewId);
  if (!plugin) return [];
  const options = plugin.getOptions(session);
  const defaultSelected = options.filter((option) => option.enabled).map((option) => option.id);
  const selected = new Set(panel?.selectedOptions ?? defaultSelected);
  return options
    .filter((option) => option.enabled && selected.has(option.id))
    .map((option) => option.label);
}

function explanation(
  viewId: WorkbenchViewId,
  id: string,
  title: string,
  summary: string,
  evidenceBasis: string[],
  session: WorkbenchSessionContext,
  kind: WorkbenchEvidenceExplanationKind = 'diagnostic',
): WorkbenchEvidenceExplanation {
  return {
    id,
    viewId,
    title,
    summary,
    evidenceBasis,
    boundary: officialBoundary(session),
    kind,
  };
}

function optionBasis(
  viewId: WorkbenchViewId,
  session: WorkbenchSessionContext,
  panel: WorkbenchPanelInstance | undefined,
  fallback: string,
): string[] {
  const labels = selectedEnabledOptionLabels(viewId, session, panel);
  return labels.length ? labels : [fallback];
}

function timeDomainExplanations(session: WorkbenchSessionContext, panel?: WorkbenchPanelInstance) {
  const basis = optionBasis('time-domain', session, panel, '时域响应曲线');
  return [
    explanation(
      'time-domain',
      'time-domain-response-evidence',
      '时域响应证据',
      `对照${basis.join('、')}，用于判断响应速度、超调、振荡和稳态误差的取舍。`,
      [modelBasis(session), ...basis],
      session,
      'tradeoff',
    ),
  ];
}

function bodeExplanations(session: WorkbenchSessionContext, panel?: WorkbenchPanelInstance) {
  const basis = optionBasis('bode', session, panel, '开环频率响应');
  return [
    explanation(
      'bode',
      'bode-frequency-evidence',
      '频域裕度证据',
      `读取${basis.join('、')}，用于判断低频增益、中频穿越和高频衰减是否支持当前校正方向。`,
      [modelBasis(session), ...basis],
      session,
      'tradeoff',
    ),
  ];
}

function rootLocusExplanations(session: WorkbenchSessionContext, panel?: WorkbenchPanelInstance) {
  const basis = optionBasis('root-locus', session, panel, '根轨迹');
  return [
    explanation(
      'root-locus',
      'root-locus-pole-evidence',
      '闭环极点趋势证据',
      `${basis.join('、')}说明增益变化时主导极点的移动方向，适合判断阻尼、稳定边界和校正零极点的作用。`,
      [modelBasis(session), ...basis],
      session,
    ),
  ];
}

function nyquistExplanations(session: WorkbenchSessionContext, panel?: WorkbenchPanelInstance) {
  const basis = optionBasis('nyquist', session, panel, 'Nyquist 轨迹');
  return [
    explanation(
      'nyquist',
      'nyquist-stability-evidence',
      '环绕关系证据',
      `${basis.join('、')}用于检查临界点附近的相对位置和稳定裕度，不替代提交后的正式判分。`,
      [modelBasis(session), ...basis],
      session,
    ),
  ];
}

function experimentDatasetExplanations(session: WorkbenchSessionContext, panel?: WorkbenchPanelInstance) {
  const basis = optionBasis('experiment-dataset', session, panel, '竞技场持久化实验数据集');
  const budget = session.experimentPolicy.budgetLimit ?? session.experimentPolicy.maxRuns;
  return [
    explanation(
      'experiment-dataset',
      'blackbox-experiment-coverage-evidence',
      '实验覆盖证据',
      `黑箱实验数据反映已采样输入输出的覆盖范围和实验预算${budget ? `（上限 ${budget} 次）` : ''}，只能支持名义模型判断。`,
      [...basis, '实验预算', '输入输出数据'],
      session,
      'privacy',
    ),
  ];
}

function identificationExplanations(session: WorkbenchSessionContext, panel?: WorkbenchPanelInstance) {
  const basis = optionBasis('identification', session, panel, '学生名义模型');
  return [
    explanation(
      'identification',
      'blackbox-nominal-model-evidence',
      '名义模型证据',
      `${basis.join('、')}来自学生采集数据和识别假设，可解释控制器设计依据；不展示官方隐藏对象。`,
      [...basis, '学生名义模型', '识别数据'],
      session,
      'privacy',
    ),
  ];
}

function responseComparisonExplanations(session: WorkbenchSessionContext, panel?: WorkbenchPanelInstance) {
  const basis = optionBasis('response-comparison', session, panel, '响应对照');
  return [
    explanation(
      'response-comparison',
      'response-comparison-preview-evidence',
      '响应对照证据',
      `${basis.join('、')}展示名义模型、虚拟预演或扰动抑制之间的一致性与偏差，适合定位预览与真实提交之间的风险。`,
      [modelBasis(session), ...basis, '预演偏差'],
      session,
      'official-boundary',
    ),
  ];
}

function controlEffortExplanations(session: WorkbenchSessionContext, panel?: WorkbenchPanelInstance) {
  const basis = optionBasis('control-effort', session, panel, '控制量估计');
  return [
    explanation(
      'control-effort',
      'control-effort-tradeoff-evidence',
      '控制代价证据',
      `${basis.join('、')}用于发现过大的控制能量、执行器压力和性能改善之间的折中。`,
      [...basis, '控制量代价'],
      session,
      'tradeoff',
    ),
  ];
}

function metricSummaryExplanations(session: WorkbenchSessionContext, panel?: WorkbenchPanelInstance) {
  const basis = optionBasis('metric-summary', session, panel, '官方评测指标摘要');
  return [
    explanation(
      'metric-summary',
      'metric-summary-boundary-evidence',
      '指标边界证据',
      `${basis.join('、')}帮助把可见曲线读数连接到 ${metricBasis(session).join('、')} 等指标，但不提前承诺榜单名次。`,
      [...basis, ...metricBasis(session)],
      session,
      'official-boundary',
    ),
  ];
}

export const WORKBENCH_VIEW_PLUGINS: WorkbenchViewPlugin[] = [
  {
    id: 'time-domain',
    title: '时域响应',
    getAvailability: () => ({ available: true }),
    getOptions: (session) => {
      const modelReady = hasModelSource(session);
      const controllerReady = hasResponsePreviewControllerSource(session);
      return [
        enabledOption('reference', '参考输入'),
        modelReady
          ? enabledOption('uncorrected-output', '未校正输出')
          : disabledOption('uncorrected-output', '未校正输出', '暂无公开模型或名义模型。'),
        modelReady && controllerReady
          ? enabledOption('corrected-output', '校正后输出')
          : disabledOption('corrected-output', '校正后输出', '暂无可用于预览的控制器。'),
        disabledOption('blackbox-output', '黑箱实验输出', '没有黑箱实验数据，不能合成占位曲线。'),
      ];
    },
    getExplanations: timeDomainExplanations,
  },
  {
    id: 'bode',
    title: 'Bode 图',
    getAvailability: modelAvailability,
    getOptions: (session) => {
      const modelReady = hasModelSource(session);
      const controllerReady = hasClassicalCorrectionSource(session);
      return [
        modelReady
          ? enabledOption('uncorrected-open-loop', '未校正开环')
          : disabledOption('uncorrected-open-loop', '未校正开环', '暂无公开模型或名义模型。'),
        modelReady && controllerReady
          ? enabledOption('corrected-open-loop', '校正后开环')
          : disabledOption('corrected-open-loop', '校正后开环', '暂无可用于预览的控制器。'),
        controllerReady
          ? enabledOption('correction-device', '校正装置')
          : disabledOption('correction-device', '校正装置', '当前方法没有独立校正装置。'),
      ];
    },
    getExplanations: bodeExplanations,
  },
  {
    id: 'root-locus',
    title: '根轨迹',
    getAvailability: modelAvailability,
    getOptions: (session) => {
      const modelReady = hasModelSource(session);
      const controllerReady = hasClassicalCorrectionSource(session);
      return [
        modelReady
          ? enabledOption('uncorrected-root-locus', '未校正根轨迹')
          : disabledOption('uncorrected-root-locus', '未校正根轨迹', '暂无公开模型或名义模型。'),
        modelReady && controllerReady
          ? enabledOption('corrected-root-locus', '校正后根轨迹')
          : disabledOption('corrected-root-locus', '校正后根轨迹', '暂无可用于预览的控制器。'),
        hasNominalModel(session)
          ? enabledOption('nominal-root-locus', '名义模型根轨迹')
          : disabledOption('nominal-root-locus', '名义模型根轨迹', '尚未建立名义模型。'),
      ];
    },
    getExplanations: rootLocusExplanations,
  },
  {
    id: 'nyquist',
    title: 'Nyquist 图',
    getAvailability: modelAvailability,
    getOptions: (session) => {
      const modelReady = hasModelSource(session);
      const controllerReady = hasClassicalCorrectionSource(session);
      return [
        modelReady
          ? enabledOption('uncorrected-open-loop', '未校正开环')
          : disabledOption('uncorrected-open-loop', '未校正开环', '暂无公开模型或名义模型。'),
        modelReady && controllerReady
          ? enabledOption('corrected-open-loop', '校正后开环')
          : disabledOption('corrected-open-loop', '校正后开环', '暂无可用于预览的控制器。'),
      ];
    },
    getExplanations: nyquistExplanations,
  },
  {
    id: 'experiment-dataset',
    title: '黑箱实验数据',
    getAvailability: (session) => (
      session.experimentPolicy.requiresPersistedDataset
        ? { available: true }
        : { available: false, reason: '当前会话不要求持久化黑箱实验数据。' }
    ),
    getOptions: (session) => [
      session.experimentPolicy.requiresPersistedDataset
        ? enabledOption('persisted-experiment-dataset', '竞技场持久化实验数据集')
        : disabledOption('persisted-experiment-dataset', '竞技场持久化实验数据集', '当前会话不使用黑箱实验服务。'),
    ],
    getExplanations: experimentDatasetExplanations,
  },
  {
    id: 'identification',
    title: '学生名义模型',
    getAvailability: (session) => (
      session.officialTarget?.hiddenTarget
        ? { available: true }
        : { available: false, reason: '当前对象不是隐藏黑箱对象。' }
    ),
    getOptions: () => [
      enabledOption('student-nominal-model', '学生名义模型'),
      disabledOption('official-hidden-target', '官方隐藏对象', '官方隐藏对象不展示为模型。'),
    ],
    getExplanations: identificationExplanations,
  },
  {
    id: 'response-comparison',
    title: '名义模型响应对照',
    getAvailability: () => ({ available: true }),
    getOptions: (session) => {
      const options = [
        enabledOption('nominal-model-response', '学生名义模型响应'),
        enabledOption('virtual-preview-response', '虚拟仿真预演响应'),
      ];
      if (session.allowedMethods.includes('composite-compensation')) {
        options.push(enabledOption('disturbance-rejection-response', '扰动抑制响应'));
      }
      return options;
    },
    getExplanations: responseComparisonExplanations,
  },
  {
    id: 'control-effort',
    title: '控制量',
    getAvailability: () => ({ available: true }),
    getOptions: (session) => [
      hasControlEffortSource(session)
        ? enabledOption('control-effort-estimate', '控制量估计')
        : disabledOption('control-effort-estimate', '控制量估计', '当前方法没有控制量估计。'),
    ],
    getExplanations: controlEffortExplanations,
  },
  {
    id: 'metric-summary',
    title: '指标摘要',
    getAvailability: () => ({ available: true }),
    getOptions: () => [
      enabledOption('leaderboard-official-metrics', '官方评测指标摘要'),
    ],
    getExplanations: metricSummaryExplanations,
  },
];

const CLASSIC_WHITEBOX_VIEW_CONFIGS: WorkbenchViewConfig[] = [
  {
    id: 'time-domain',
    title: '时域响应',
    enabled: true,
    selectedOptions: ['reference', 'uncorrected-output', 'corrected-output'],
  },
  {
    id: 'bode',
    title: 'Bode 图',
    enabled: true,
    selectedOptions: ['uncorrected-open-loop', 'corrected-open-loop', 'correction-device'],
  },
  {
    id: 'root-locus',
    title: '根轨迹',
    enabled: true,
    selectedOptions: ['uncorrected-root-locus', 'corrected-root-locus'],
  },
  {
    id: 'nyquist',
    title: 'Nyquist 图',
    enabled: true,
    selectedOptions: ['uncorrected-open-loop', 'corrected-open-loop'],
  },
];

const DEFAULT_VIEW_CONFIGS: Record<WorkbenchPresetId, WorkbenchViewConfig[]> = {
  'classic-whitebox': CLASSIC_WHITEBOX_VIEW_CONFIGS,
  'blackbox-identification': [
    { id: 'experiment-dataset', title: '黑箱实验数据', enabled: true, selectedOptions: ['persisted-experiment-dataset'] },
    { id: 'identification', title: '学生名义模型', enabled: true, selectedOptions: ['student-nominal-model'] },
    { id: 'response-comparison', title: '名义模型响应对照', enabled: true, selectedOptions: ['nominal-model-response', 'virtual-preview-response'] },
    { id: 'metric-summary', title: '指标摘要', enabled: true, selectedOptions: ['leaderboard-official-metrics'] },
  ],
  'composite-control': [
    { id: 'time-domain', title: '时域响应', enabled: true, selectedOptions: ['reference', 'corrected-output'] },
    { id: 'response-comparison', title: '响应与扰动对照', enabled: true, selectedOptions: ['virtual-preview-response', 'disturbance-rejection-response'] },
    { id: 'control-effort', title: '控制量', enabled: true, selectedOptions: ['control-effort-estimate'] },
    { id: 'metric-summary', title: '结构与指标摘要', enabled: true, selectedOptions: ['leaderboard-official-metrics'] },
  ],
  'predictive-control': [
    { id: 'time-domain', title: '模板预览', enabled: true, selectedOptions: ['reference', 'corrected-output'] },
    { id: 'control-effort', title: '控制量与约束', enabled: true, selectedOptions: ['control-effort-estimate'] },
    { id: 'metric-summary', title: '官方指标摘要', enabled: true, selectedOptions: ['leaderboard-official-metrics'] },
  ],
  'assignment-guided': CLASSIC_WHITEBOX_VIEW_CONFIGS,
  odyssey: [
    { id: 'time-domain', title: '时域响应', enabled: true, selectedOptions: ['reference', 'corrected-output'] },
    { id: 'metric-summary', title: '指标摘要', enabled: true },
  ],
  'free-explore': CLASSIC_WHITEBOX_VIEW_CONFIGS,
};

export function getWorkbenchViewPlugin(viewId: WorkbenchViewId) {
  return WORKBENCH_VIEW_PLUGINS.find((plugin) => plugin.id === viewId);
}

export function buildWorkbenchPanelExplanations(
  session: WorkbenchSessionContext,
  panel: WorkbenchPanelInstance,
): WorkbenchEvidenceExplanation[] {
  const plugin = getWorkbenchViewPlugin(panel.viewId);
  if (!plugin || !panel.enabled) return [];
  const availability = plugin.getAvailability(session);
  if (!availability.available) return [];
  return plugin.getExplanations(session, panel);
}

export function getPresetDefaultViewConfigs(presetId: WorkbenchPresetId) {
  return DEFAULT_VIEW_CONFIGS[presetId].map((config) => ({
    ...config,
    selectedOptions: config.selectedOptions ? [...config.selectedOptions] : undefined,
    signalKinds: config.signalKinds ? [...config.signalKinds] : undefined,
    signalSources: config.signalSources ? [...config.signalSources] : undefined,
    settings: config.settings ? { ...config.settings } : undefined,
  }));
}

function buildPanelId(presetId: WorkbenchPresetId, config: WorkbenchViewConfig, index: number) {
  return `panel-${presetId}-${index + 1}-${config.id}`;
}

export function buildWorkbenchPanelInstance(
  config: WorkbenchViewConfig,
  id: string,
): WorkbenchPanelInstance {
  return {
    id,
    viewId: config.id,
    title: config.title,
    enabled: config.enabled,
    selectedOptions: config.selectedOptions ? [...config.selectedOptions] : undefined,
    signalKinds: config.signalKinds ? [...config.signalKinds] : undefined,
    signalSources: config.signalSources ? [...config.signalSources] : undefined,
    settings: config.settings ? { ...config.settings } : undefined,
  };
}

export function buildDefaultWorkbenchPanelInstances(
  session: WorkbenchSessionContext,
): WorkbenchPanelInstance[] {
  return getPresetDefaultViewConfigs(session.defaultPreset)
    .filter((config) => session.allowedViews.includes(config.id))
    .map((config, index) => {
      const plugin = getWorkbenchViewPlugin(config.id);
      const availability = plugin?.getAvailability(session) ?? { available: true };
      return buildWorkbenchPanelInstance(
        {
          ...config,
          enabled: config.enabled && availability.available,
        },
        buildPanelId(session.defaultPreset, config, index),
      );
    });
}

export function workbenchPanelToViewConfig(panel: WorkbenchPanelInstance): WorkbenchViewConfig {
  return {
    id: panel.viewId,
    title: panel.title,
    enabled: panel.enabled,
    selectedOptions: panel.selectedOptions ? [...panel.selectedOptions] : undefined,
    signalKinds: panel.signalKinds ? [...panel.signalKinds] : undefined,
    signalSources: panel.signalSources ? [...panel.signalSources] : undefined,
    settings: panel.settings ? { ...panel.settings } : undefined,
  };
}

export function keyedViewConfigsFromPanels(
  panels: WorkbenchPanelInstance[],
  defaultConfigs: WorkbenchViewConfig[] = [],
): Partial<Record<WorkbenchViewId, WorkbenchViewConfig>> {
  const viewConfigs = Object.fromEntries(
    panels.map((panel) => [panel.viewId, workbenchPanelToViewConfig(panel)]),
  ) as Partial<Record<WorkbenchViewId, WorkbenchViewConfig>>;
  const activeViewIds = new Set(panels.map((panel) => panel.viewId));

  for (const config of defaultConfigs) {
    if (!activeViewIds.has(config.id)) {
      viewConfigs[config.id] = {
        ...config,
        enabled: false,
        selectedOptions: [],
      };
    }
  }

  return viewConfigs;
}

function isSingleSelectionView(viewId: WorkbenchViewId) {
  return viewId === 'root-locus' || viewId === 'nyquist';
}

export function toggleWorkbenchPanelOption(
  panels: WorkbenchPanelInstance[],
  panelId: string,
  optionId: string,
): WorkbenchPanelInstance[] {
  return panels.map((panel) => {
    if (panel.id !== panelId) return panel;

    if (isSingleSelectionView(panel.viewId)) {
      return {
        ...panel,
        selectedOptions: [optionId],
      };
    }

    const selected = new Set(panel.selectedOptions ?? []);
    if (selected.has(optionId)) {
      selected.delete(optionId);
    } else {
      selected.add(optionId);
    }
    return {
      ...panel,
      selectedOptions: Array.from(selected),
    };
  });
}
