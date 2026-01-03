/**
 * 课堂组件类型定义
 *
 * 课堂组件是功能性的、可编辑的通用组件，供教师在编排课程时填入个性化内容。
 * 与互动学习模块不同，课堂组件没有固定的学习主题，而是提供投票、视频播放等功能。
 */

// ========== 基础类型 ==========

/** 组件模式：编辑模式用于教师配置，播放模式用于课堂展示 */
export type ComponentMode = 'edit' | 'play';

/** 课堂组件基础配置 */
export interface BaseComponentConfig {
  /** 组件唯一标识 */
  id: string;
  /** 组件类型 */
  type: ClassroomComponentType;
}

/** 课堂组件基础属性 */
export interface BaseClassroomComponentProps<T extends BaseComponentConfig> {
  /** 编辑/播放模式 */
  mode: ComponentMode;
  /** 组件配置 */
  config: T;
  /** 配置变更回调（仅编辑模式） */
  onConfigChange?: (config: T) => void;
  /** 课堂会话ID */
  classroomSession?: string;
  /** 用户ID */
  userId?: string;
}

/** 课堂组件类型枚举 */
export type ClassroomComponentType =
  | 'video'
  | 'poll'
  | 'objective'
  | 'assessment'
  | 'ai-report'
  | 'ethical-trigger';

// ========== VideoComponent 视频组件 ==========

/** 视频来源类型 */
export type VideoSourceType = 'url' | 'placeholder';

/** 分屏模式 */
export type SplitMode = 'none' | 'horizontal' | 'vertical';

/** 视频组件配置 */
export interface VideoComponentConfig extends BaseComponentConfig {
  type: 'video';
  /** 视频标题 */
  title: string;
  /** 视频来源类型 */
  sourceType: VideoSourceType;
  /** 主视频URL或占位符图片 */
  primarySource: string;
  /** 副视频URL或占位符图片（分屏模式） */
  secondarySource?: string;
  /** 分屏模式 */
  splitMode: SplitMode;
  /** AI旁白文本 */
  narration?: string;
  /** 视频描述（占位符模式显示） */
  description?: string;
  /** 是否自动播放 */
  autoPlay?: boolean;
  /** 播放完成后自动触发下一步 */
  autoAdvance?: boolean;
}

// ========== PollComponent 投票组件 ==========

/** 投票选项 */
export interface PollOption {
  /** 选项标识 (A/B/C/D) */
  key: string;
  /** 选项文本 */
  text: string;
  /** 选项颜色 */
  color?: string;
}

/** 投票结果 */
export interface PollResult {
  /** 选项标识 */
  optionKey: string;
  /** 投票数量 */
  count: number;
  /** 投票百分比 */
  percentage: number;
}

/** 投票组件配置 */
export interface PollComponentConfig extends BaseComponentConfig {
  type: 'poll';
  /** 投票问题 */
  question: string;
  /** 选项列表 */
  options: PollOption[];
  /** 是否允许多选 */
  multiSelect?: boolean;
  /** 是否匿名投票 */
  anonymous?: boolean;
  /** 是否实时显示结果 */
  showLiveResults?: boolean;
  /** 投票时限（秒），0表示无限制 */
  timeLimit?: number;
}

/** 投票组件状态 */
export interface PollState {
  /** 当前投票结果 */
  results: PollResult[];
  /** 总投票人数 */
  totalVotes: number;
  /** 当前用户是否已投票 */
  hasVoted: boolean;
  /** 当前用户的选择 */
  userChoice?: string[];
  /** 投票是否已关闭 */
  isClosed: boolean;
}

// ========== ObjectiveCard 学习目标组件 ==========

/** 目标类型 */
export type ObjectiveType = 'knowledge' | 'ability' | 'value';

/** 学习目标项 */
export interface ObjectiveItem {
  /** 目标ID */
  id: string;
  /** 目标类型 */
  type: ObjectiveType;
  /** 目标描述 */
  description: string;
  /** 徽章名称 */
  badgeName?: string;
  /** 徽章图标 (Lucide icon name) */
  badgeIcon?: string;
  /** 是否已解锁 */
  unlocked?: boolean;
}

/** 学习目标组件配置 */
export interface ObjectiveCardConfig extends BaseComponentConfig {
  type: 'objective';
  /** 课程标题 */
  title: string;
  /** 目标列表 */
  objectives: ObjectiveItem[];
  /** 是否显示解锁动画 */
  showUnlockAnimation?: boolean;
}

// ========== AssessmentProbe 后测评估组件 ==========

/** 评估参数 */
export interface AssessmentParameter {
  /** 参数ID */
  id: string;
  /** 参数名称 */
  name: string;
  /** 参数符号 */
  symbol: string;
  /** 最小值 */
  min: number;
  /** 最大值 */
  max: number;
  /** 步进值 */
  step: number;
  /** 默认值 */
  defaultValue?: number;
  /** 单位 */
  unit?: string;
}

/** 评分配置 */
export interface ScoringConfig {
  /** 基础分数 */
  baseScore: number;
  /** MSI权重 */
  msiWeight: number;
  /** 每次违规扣分 */
  penaltyPerViolation: number;
}

/** 评估组件配置 */
export interface AssessmentProbeConfig extends BaseComponentConfig {
  type: 'assessment';
  /** 评估标题 */
  title: string;
  /** 评估说明 */
  description: string;
  /** 需要提交的参数列表 */
  parameters: AssessmentParameter[];
  /** 评分配置 */
  scoring: ScoringConfig;
}

/** 评估结果 */
export interface AssessmentResult {
  /** 提交的参数值 */
  params: Record<string, number>;
  /** 仿真运行结果 */
  simulationResult?: {
    msi: number;
    violationCount: number;
    completionTime: number;
  };
  /** 最终得分 */
  score: number;
  /** 评分详情 */
  breakdown?: {
    baseScore: number;
    msiPenalty: number;
    violationPenalty: number;
  };
}

// ========== AIDynamicReport AI动态报告组件 ==========

/** 报告数据可视化类型 */
export type ReportVisualization = 'bar' | 'pie' | 'line' | 'radar';

/** AI报告组件配置 */
export interface AIDynamicReportConfig extends BaseComponentConfig {
  type: 'ai-report';
  /** 报告标题 */
  title: string;
  /** 报告模板（支持变量替换） */
  reportTemplate: string;
  /** 数据可视化类型列表 */
  visualizations: ReportVisualization[];
  /** 是否启用语音播报 */
  enableVoice: boolean;
  /** 语音播报脚本模板 */
  voiceScript?: string;
}

/** 报告数据点 */
export interface ReportDataPoint {
  /** 用户/组ID */
  id: string;
  /** 标签 */
  label: string;
  /** 数值 */
  values: Record<string, number>;
}

/** 报告状态 */
export interface ReportState {
  /** 数据点 */
  data: ReportDataPoint[];
  /** AI生成的报告文本 */
  generatedReport?: string;
  /** 是否正在生成 */
  isGenerating: boolean;
}

// ========== EthicalTrigger 伦理熔断组件 ==========

/** 熔断条件 */
export interface EthicalCondition {
  /** 条件ID */
  id: string;
  /** 监测指标名称 */
  metric: string;
  /** 阈值 */
  threshold: number;
  /** 当前值 */
  currentValue?: number;
  /** 单位 */
  unit?: string;
  /** 阈值运算符 */
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
}

/** 整改配置 */
export interface RemediationConfig {
  /** 整改问题 */
  question: string;
  /** 正确答案 */
  correctAnswer: string;
  /** 答案解释 */
  explanation?: string;
}

/** 伦理熔断组件配置 */
export interface EthicalTriggerConfig extends BaseComponentConfig {
  type: 'ethical-trigger';
  /** 触发条件列表 */
  conditions: EthicalCondition[];
  /** 违规类型标识 */
  violationType: string;
  /** 警告标题 */
  warningTitle: string;
  /** 警告消息 */
  warningMessage: string;
  /** 相关法规 */
  regulation?: string;
  /** 整改配置 */
  remediation: RemediationConfig;
  /** 是否播放警报音效 */
  alertSound?: boolean;
  /** 是否全屏变红 */
  fullScreenAlert?: boolean;
}

/** 熔断状态 */
export interface EthicalTriggerState {
  /** 是否已触发 */
  isTriggered: boolean;
  /** 触发的条件 */
  triggeredConditions: string[];
  /** 当前指标值 */
  currentMetrics: Record<string, number>;
  /** 是否已完成整改 */
  isRemediated: boolean;
  /** 违规次数 */
  violationCount: number;
}

// ========== 组件配置联合类型 ==========

export type ClassroomComponentConfig =
  | VideoComponentConfig
  | PollComponentConfig
  | ObjectiveCardConfig
  | AssessmentProbeConfig
  | AIDynamicReportConfig
  | EthicalTriggerConfig;

// ========== 辅助函数类型 ==========

/** 创建默认配置 */
export type CreateDefaultConfig<T extends ClassroomComponentConfig> = (id: string) => T;

/** 配置验证结果 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
}
