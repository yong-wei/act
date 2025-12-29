/**
 * 弹性课堂编排引擎数据架构
 * Elastic Lesson Engine & Atomic Resource Pool Schema
 *
 * 核心设计理念: "Atomic Resources + Linear Playlist"
 * - 资源池: 存放独立的知识点、互动组件、测验题
 * - 课程流: 定义一节课的叙事逻辑，通过"上下文注入"技术赋予原子资源教学意义
 */

// ===== 原子资源定义 (Atomic Resources) =====

/**
 * 资源类型
 */
export type ResourceType = 'concept' | 'widget' | 'quiz' | 'video';

/**
 * 资源基础接口
 */
export interface ResourceBase {
  /** 资源唯一标识，如 "concept-newton-second-law" */
  id: string;

  /** 资源类型 */
  type: ResourceType;

  /** 默认标题 */
  title: string;

  /** 标签，用于知识图谱关联，如 ["physics", "modeling"] */
  tags: string[];

  /** 元数据（可选） */
  metadata?: Record<string, unknown>;
}

/**
 * 静态概念卡片 (MDX)
 */
export interface ConceptResource extends ResourceBase {
  type: 'concept';

  /** MDX 内容文件路径，指向 content/concepts/xxx.mdx */
  contentPath: string;

  /** 预计阅读时间（分钟，可选） */
  estimatedReadTime?: number;

  /** 难度等级（1-5，可选） */
  difficulty?: 1 | 2 | 3 | 4 | 5;
}

/**
 * 交互组件 (React Component)
 */
export interface WidgetResource extends ResourceBase {
  type: 'widget';

  /** 组件名称，如 "PhysicsBuilder"，用于动态加载 */
  componentName: string;

  /** 默认 Props 配置 */
  defaultProps: Record<string, unknown>;

  /** 组件版本（可选） */
  version?: string;
}

/**
 * 测验题目
 */
export interface QuizQuestion {
  /** 题目 ID */
  id: string;

  /** 题干 */
  stem: string;

  /** 选项列表 */
  options: string[];

  /** 正确答案索引 */
  correctIndex: number;

  /** 解释说明（可选） */
  explanation?: string;

  /** 分值（默认 10） */
  points?: number;

  /** 难度等级（可选） */
  difficulty?: 1 | 2 | 3 | 4 | 5;
}

/**
 * 测验/探针资源
 */
export interface QuizResource extends ResourceBase {
  type: 'quiz';

  /** 题目列表 */
  questions: QuizQuestion[];

  /** 通过分数百分比（默认 60） */
  passingScore?: number;

  /** 是否随机题目顺序 */
  shuffleQuestions?: boolean;

  /** 时间限制（秒，可选） */
  timeLimit?: number;
}

/**
 * 视频资源
 */
export interface VideoResource extends ResourceBase {
  type: 'video';

  /** 视频 URL 或标识 */
  videoUrl: string;

  /** 视频时长（秒） */
  duration: number;

  /** 字幕文件路径（可选） */
  subtitlePath?: string;

  /** 章节标记（可选） */
  chapters?: Array<{
    title: string;
    startTime: number;
  }>;
}

/**
 * 联合资源类型
 */
export type Resource =
  | ConceptResource
  | WidgetResource
  | QuizResource
  | VideoResource;

// ===== 课程流定义 (Lesson Stream) =====

/**
 * AI 助教角色
 */
export type AIPersona = 'tutor' | 'critic' | 'analyst';

/**
 * AI 助教配置
 */
export interface AIAgentConfig {
  /** AI 角色 */
  persona: AIPersona;

  /** 系统提示扩展（可选） */
  systemPromptExtension?: string;

  /** 是否主动提问 */
  proactive?: boolean;

  /** 反馈风格 */
  feedbackStyle?: 'encouraging' | 'neutral' | 'challenging';
}

/**
 * 布局类型
 */
export type LayoutType = 'full' | 'split-left' | 'split-right' | 'drawer';

/**
 * 步骤上下文注入配置
 */
export interface StepContext {
  /** 标题覆盖 */
  titleOverride?: string;

  /** 描述覆盖（教师引导语） */
  descriptionOverride?: string;

  /** Props 覆盖（注入给组件的配置） */
  propsOverride?: Record<string, unknown>;

  /** AI 助教配置 */
  aiAgentConfig?: AIAgentConfig;

  /** 完成条件（可选） */
  completionCriteria?: {
    /** 最小停留时间（秒） */
    minDuration?: number;
    /** 需要完成的交互 */
    requiredInteraction?: string;
    /** 需要达到的分数 */
    requiredScore?: number;
  };
}

/**
 * 课程步骤
 */
export interface LessonStep {
  /** 步骤唯一 ID */
  id: string;

  /** 引用资源池中的资源 ID */
  resourceId: string;

  /** 上下文注入配置 */
  context: StepContext;

  /** 布局配置 */
  layout?: LayoutType;

  /** 是否可跳过 */
  skippable?: boolean;

  /** 预计时长（分钟，可选） */
  estimatedDuration?: number;
}

/**
 * 课程清单
 */
export interface LessonManifest {
  /** 课程唯一 ID，如 "lesson-03-modeling" */
  id: string;

  /** 课程标题 */
  title: string;

  /** 课程描述 */
  description: string;

  /** 建议时长（分钟） */
  durationMinutes: number;

  /** 有序的教学步骤 */
  steps: LessonStep[];

  /** 课程版本 */
  version?: string;

  /** 作者 */
  author?: string;

  /** 前置课程 */
  prerequisites?: string[];

  /** 学习目标 */
  objectives?: string[];

  /** 创建时间 */
  createdAt?: string;

  /** 更新时间 */
  updatedAt?: string;
}

// ===== 资源注册表 (Resource Registry) =====

/**
 * 资源池
 */
export interface ResourcePool {
  /** 资源 ID 到资源的映射 */
  resources: Record<string, Resource>;

  /** 按类型索引 */
  byType: Record<ResourceType, string[]>;

  /** 按标签索引 */
  byTag: Record<string, string[]>;
}

/**
 * 组件注册表配置
 */
export interface ComponentRegistryConfig {
  /** 组件名称到异步加载器的映射 */
  [componentName: string]: () => Promise<React.ComponentType<unknown>>;
}

// ===== 运行时状态 (Runtime State) =====

/**
 * 步骤完成状态
 */
export type StepStatus = 'locked' | 'available' | 'in_progress' | 'completed';

/**
 * 步骤进度
 */
export interface StepProgress {
  /** 步骤 ID */
  stepId: string;

  /** 状态 */
  status: StepStatus;

  /** 开始时间 */
  startedAt?: Date;

  /** 完成时间 */
  completedAt?: Date;

  /** 花费时间（秒） */
  timeSpent: number;

  /** 交互数据（可选） */
  interactionData?: Record<string, unknown>;

  /** 得分（可选） */
  score?: number;
}

/**
 * 课程会话状态
 */
export interface LessonSessionState {
  /** 会话 ID */
  sessionId: string;

  /** 课程 ID */
  lessonId: string;

  /** 用户 ID */
  userId: string;

  /** 当前步骤索引 */
  currentStepIndex: number;

  /** 总步骤数 */
  totalSteps: number;

  /** 是否为教师模式 */
  isTeacherMode: boolean;

  /** 各步骤进度 */
  stepProgress: StepProgress[];

  /** 会话开始时间 */
  startedAt: Date;

  /** 最后活动时间 */
  lastActiveAt: Date;

  /** 是否完成 */
  isCompleted: boolean;
}

// ===== 课堂同步 (Classroom Sync) =====

/**
 * 同步事件类型
 */
export type SyncEventType =
  | 'SYNC_STEP'           // 同步步骤
  | 'SYNC_STATE'          // 同步完整状态
  | 'STUDENT_JOIN'        // 学生加入
  | 'STUDENT_LEAVE'       // 学生离开
  | 'TEACHER_PAUSE'       // 教师暂停
  | 'TEACHER_RESUME';     // 教师继续

/**
 * 同步事件载荷
 */
export interface SyncEventPayload {
  /** 事件类型 */
  type: SyncEventType;

  /** 课堂会话 ID */
  classroomSessionId: string;

  /** 发送者 ID */
  senderId: string;

  /** 发送者角色 */
  senderRole: 'teacher' | 'student';

  /** 时间戳 */
  timestamp: number;

  /** 数据载荷 */
  data: {
    /** 步骤索引 */
    stepIndex?: number;

    /** 完整状态（用于 SYNC_STATE） */
    fullState?: Partial<LessonSessionState>;

    /** 用户信息（用于加入/离开） */
    userInfo?: {
      userId: string;
      userName: string;
    };
  };
}

/**
 * 课堂会话
 */
export interface ClassroomSession {
  /** 会话 ID */
  id: string;

  /** 课程 ID */
  lessonId: string;

  /** 教师 ID */
  teacherId: string;

  /** 当前步骤索引 */
  currentStepIndex: number;

  /** 是否暂停 */
  isPaused: boolean;

  /** 在线学生 ID 列表 */
  onlineStudents: string[];

  /** 创建时间 */
  createdAt: Date;

  /** 频道名称 */
  channelName: string;
}

// ===== 工具类型 =====

/**
 * 根据资源类型获取对应的资源接口
 */
export type ResourceByType<T extends ResourceType> = T extends 'concept'
  ? ConceptResource
  : T extends 'widget'
    ? WidgetResource
    : T extends 'quiz'
      ? QuizResource
      : T extends 'video'
        ? VideoResource
        : never;

/**
 * 提取资源 Props 类型
 */
export type ExtractResourceProps<R extends Resource> = R extends WidgetResource
  ? R['defaultProps']
  : never;
