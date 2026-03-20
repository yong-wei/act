/**
 * 分层AI上下文类型定义
 *
 * 三层架构模型：
 * - Layer 1: Static Semantic (静态语义层) - 来自课程预配置
 * - Layer 2: Runtime State (运行时状态层) - 页面实时状态
 * - Layer 3: Dynamic Retrieval (动态检索层) - 动态检索的补充信息
 */

import type { PageType, KnowledgeType, BopppsStage } from './ai-context';

// ============================================================================
// Layer 1: 静态语义层
// ============================================================================

/**
 * Layer 1: 静态语义层
 * 来自课程预配置，不随页面状态变化
 */
export interface StaticSemanticContext {
  /** 课程元数据 */
  courseMeta: {
    courseId: string;
    courseTitle: string;
    courseDescription: string;
    keyConcepts: string[];
  };

  /** 步骤元数据 */
  stepMeta: {
    stepId: string;
    stepType: PageType;
    topic: string;
    learningObjectives: string[];
    knowledgeType: KnowledgeType;
    bopppsStage?: BopppsStage;
  };

  /** 教学意图 */
  pedagogicalIntent: {
    focus: string;
    commonMisconceptions: string[];
    suggestedScaffolds: string[];
    assessmentCriteria?: string[];
  };

  /** 关联知识点 */
  knowledgePoints: Array<{
    id: string;
    name: string;
    difficulty: number;
    prerequisiteIds: string[];
  }>;
}

// ============================================================================
// Layer 2: 运行时状态层
// ============================================================================

/**
 * 交互事件
 */
export interface InteractionEvent {
  type: string;
  target: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

/** 理论页状态 */
export interface TheoryPageState {
  type: 'theory';
  currentSection?: string;
  readingProgress: number; // 0-1
  highlightedConcepts: string[];
  notes?: string;
}

/** 练习页状态 */
export interface PracticePageState {
  type: 'practice';
  currentTask: string;
  attempts: number;
  lastAnswer?: unknown;
  errorPattern?: string;
  hintsUsed: number;
  completionProgress: number;
}

/** 仿真参数调整记录 */
export interface ParameterManipulation {
  param: string;
  from: number;
  to: number;
  timestamp: number;
}

/** 仿真页状态 */
export interface SimulationPageState {
  type: 'simulation';
  parameters: Record<string, number>;
  observedMetrics: Record<string, number>;
  manipulationHistory: ParameterManipulation[];
  selectedView?: string;
}

/** 测验页状态 */
export interface QuizPageState {
  type: 'quiz';
  currentQuestion: number;
  totalQuestions: number;
  answers: Record<string, unknown>;
  timeSpent: number;
  flaggedQuestions: string[];
  weakAreas: string[];
}

/** 反思页状态 */
export interface ReflectionPageState {
  type: 'reflection';
  prompt: string;
  draftContent?: string;
  reflectionDepth: 'surface' | 'deep' | 'critical';
}

/** 工作区页状态 */
export interface WorkspacePageState {
  type: 'workspace';
  activeTool?: string;
  workspaceData: Record<string, unknown>;
  undoStackSize: number;
  lastAction?: string;
}

/** 总结页状态 */
export interface SummaryPageState {
  type: 'summary';
  reviewedConcepts: string[];
  masteryLevels: Record<string, number>;
  timeSpent: number;
}

/**
 * 页面特定状态联合类型
 */
export type PageSpecificState =
  | TheoryPageState
  | PracticePageState
  | SimulationPageState
  | QuizPageState
  | ReflectionPageState
  | WorkspacePageState
  | SummaryPageState;

/**
 * Layer 2: 运行时状态层
 * 动态捕获的页面实时状态
 */
export interface RuntimeStateContext {
  /** 页面类型 */
  pageType: PageType;

  /** 页面特定状态（由对应Extractor生成） */
  pageState: PageSpecificState;

  /** 学生交互轨迹 */
  interactionHistory: InteractionEvent[];

  /** 当前选中/聚焦的元素 */
  focusedElements?: string[];

  /** 时间戳 */
  timestamp: number;

  /** 会话持续时间(秒) */
  sessionDuration: number;
}

// ============================================================================
// Layer 3: 动态检索层
// ============================================================================

/**
 * 知识片段
 */
export interface KnowledgeFragment {
  id: string;
  content: string;
  source: string;
  relevance: number; // 0-1
  type: 'concept' | 'example' | 'exercise' | 'hint';
}

/**
 * Layer 3: 动态检索层
 * 根据当前上下文动态检索的补充信息
 */
export interface DynamicRetrievalContext {
  /** 相关知识片段 */
  relatedFragments: KnowledgeFragment[];

  /** 历史会话摘要 */
  recentSessionSummary?: string;

  /** 个性化提示 */
  personalizedHints: string[];

  /** 常见错误预警 */
  predictedMisconceptions: string[];
}

// ============================================================================
// 完整三层上下文
// ============================================================================

/**
 * 完整的三层上下文
 */
export interface LayeredAIContext {
  static: StaticSemanticContext;
  runtime: RuntimeStateContext;
  retrieval: DynamicRetrievalContext;
}

// ============================================================================
// 上下文组装选项
// ============================================================================

/**
 * 上下文组装选项
 */
export interface AssembleOptions {
  /** Token预算 */
  tokenBudget?: number;
  /** 是否启用检索 */
  enableRetrieval?: boolean;
  /** 是否包含历史会话 */
  includeHistory?: boolean;
  /** 字段优先级覆盖 */
  priorityOverrides?: string[];
}

// ============================================================================
// 运行时状态快照 (前端传递)
// ============================================================================

/**
 * 运行时状态快照
 * 前端页面传递给后端的完整状态
 */
export interface RuntimeStateSnapshot {
  pageType: PageType;
  state: PageSpecificState;
  interactionHistory: InteractionEvent[];
  timestamp: number;
  sessionDuration?: number;
  focusedElements?: string[];
}
