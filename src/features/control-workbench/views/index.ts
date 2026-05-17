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

export interface WorkbenchViewPlugin {
  id: WorkbenchViewId;
  title: string;
  getAvailability: (session: WorkbenchSessionContext) => WorkbenchViewAvailability;
  getOptions: (session: WorkbenchSessionContext) => WorkbenchViewOption[];
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

function hasControllerSource(session: WorkbenchSessionContext) {
  return session.allowedMethods.includes('serial-compensator') || session.allowedMethods.includes('pid');
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

export const WORKBENCH_VIEW_PLUGINS: WorkbenchViewPlugin[] = [
  {
    id: 'time-domain',
    title: '时域响应',
    getAvailability: () => ({ available: true }),
    getOptions: (session) => {
      const modelReady = hasModelSource(session);
      const controllerReady = hasControllerSource(session);
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
  },
  {
    id: 'bode',
    title: 'Bode 图',
    getAvailability: modelAvailability,
    getOptions: (session) => {
      const modelReady = hasModelSource(session);
      const controllerReady = hasControllerSource(session);
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
  },
  {
    id: 'root-locus',
    title: '根轨迹',
    getAvailability: modelAvailability,
    getOptions: (session) => {
      const modelReady = hasModelSource(session);
      const controllerReady = hasControllerSource(session);
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
  },
  {
    id: 'nyquist',
    title: 'Nyquist 图',
    getAvailability: modelAvailability,
    getOptions: (session) => {
      const modelReady = hasModelSource(session);
      const controllerReady = hasControllerSource(session);
      return [
        modelReady
          ? enabledOption('uncorrected-open-loop', '未校正开环')
          : disabledOption('uncorrected-open-loop', '未校正开环', '暂无公开模型或名义模型。'),
        modelReady && controllerReady
          ? enabledOption('corrected-open-loop', '校正后开环')
          : disabledOption('corrected-open-loop', '校正后开环', '暂无可用于预览的控制器。'),
      ];
    },
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
  },
  {
    id: 'control-effort',
    title: '控制量',
    getAvailability: () => ({ available: true }),
    getOptions: (session) => [
      session.allowedMethods.includes('composite-compensation') || session.allowedMethods.includes('mpc')
        ? enabledOption('control-effort-estimate', '控制量估计')
        : disabledOption('control-effort-estimate', '控制量估计', '当前方法没有控制量估计。'),
    ],
  },
  {
    id: 'metric-summary',
    title: '指标摘要',
    getAvailability: () => ({ available: true }),
    getOptions: () => [
      enabledOption('leaderboard-official-metrics', '官方评测指标摘要'),
    ],
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
    selectedOptions: ['corrected-root-locus'],
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

export function getPresetDefaultViewConfigs(presetId: WorkbenchPresetId) {
  return DEFAULT_VIEW_CONFIGS[presetId].map((config) => ({
    ...config,
    selectedOptions: config.selectedOptions ? [...config.selectedOptions] : undefined,
    signalKinds: config.signalKinds ? [...config.signalKinds] : undefined,
    signalSources: config.signalSources ? [...config.signalSources] : undefined,
    settings: config.settings ? { ...config.settings } : undefined,
  }));
}
