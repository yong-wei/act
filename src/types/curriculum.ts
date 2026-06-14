/**
 * 弹性课程引擎类型定义
 * Flexible Curriculum Engine Type Definitions
 *
 * 支持 60 学时的《自动控制原理》课程弹性编排
 */

// ===== 基础枚举类型 =====

/**
 * 课程模块标识符（6个核心模块）
 */
export type ModuleId =
  | 'introduction'      // 引论
  | 'modeling'          // 系统建模
  | 'time-domain'       // 时域分析
  | 'frequency-domain'  // 频域分析
  | 'design'            // 系统设计
  | 'nonlinear';        // 非线性控制

/**
 * 课时类型
 */
export type LessonType =
  | 'theory'    // 理论讲授
  | 'workshop'  // 实践工坊
  | 'battle'    // 挑战模式
  | 'review';   // 复习总结

/**
 * AI 助教角色设定
 */
export type AIPersonaId =
  | 'analyst'         // 分析师：严谨专业，注重数学推导
  | 'devil_advocate'  // 魔鬼代言人：挑战学生思维，提出反例
  | 'tutor';          // 导师：耐心引导，循序渐进

// ===== 课程配置接口 =====

/**
 * 课时配置
 */
export interface LessonConfig {
  /** 课时唯一标识，如 'lesson-03-differential-equations' */
  id: string;

  /** 课时标题 */
  title: string;

  /** 建议时长（分钟），如 90 */
  durationMinutes: number;

  /** 课时类型 */
  type: LessonType;

  /** 运行态 Markdown 内容路径，指向 course-content/runtime/lessons/.../*.md */
  contentPath: string;

  /** 预加载资源列表（如 3D 模型 key） */
  assets?: string[];

  /** 关联的 AI 角色设定 */
  aiPersonaId: AIPersonaId;

  /** 前置课时依赖（可选） */
  prerequisites?: string[];

  /** 学习目标（可选） */
  objectives?: string[];

  /** 难度等级 1-5（可选） */
  difficulty?: 1 | 2 | 3 | 4 | 5;
}

/**
 * 课程模块
 */
export interface CourseModule {
  /** 模块标识符 */
  id: ModuleId;

  /** 模块标题 */
  title: string;

  /** 模块描述（可选） */
  description?: string;

  /** 模块图标（可选，用于 UI 展示） */
  icon?: string;

  /** 包含的课时列表 */
  lessons: LessonConfig[];

  /** 模块学时数（可选，自动计算） */
  totalHours?: number;
}

/**
 * 完整课程配置
 */
export interface CourseConfig {
  /** 课程标识 */
  id: string;

  /** 课程名称 */
  name: string;

  /** 课程版本 */
  version: string;

  /** 总学时 */
  totalHours: number;

  /** 课程模块列表 */
  modules: CourseModule[];

  /** 课程元数据 */
  metadata?: {
    author?: string;
    institution?: string;
    lastUpdated?: string;
    language?: string;
  };
}

// ===== 学习进度跟踪 =====

/**
 * 课时进度状态
 */
export type LessonStatus =
  | 'locked'      // 未解锁
  | 'available'   // 可学习
  | 'in_progress' // 学习中
  | 'completed';  // 已完成

/**
 * 课时学习进度
 */
export interface LessonProgress {
  /** 课时 ID */
  lessonId: string;

  /** 进度状态 */
  status: LessonStatus;

  /** 完成时间（可选） */
  completedAt?: Date;

  /** 得分（0-100，可选） */
  score?: number;

  /** 实际花费时间（分钟） */
  timeSpentMinutes: number;

  /** 尝试次数 */
  attempts?: number;

  /** 最佳成绩（可选） */
  bestScore?: number;

  /** 学习笔记（可选） */
  notes?: string;
}

/**
 * 模块学习进度
 */
export interface ModuleProgress {
  /** 模块 ID */
  moduleId: ModuleId;

  /** 已完成课时数 */
  completedLessons: number;

  /** 总课时数 */
  totalLessons: number;

  /** 模块得分（平均分） */
  averageScore?: number;

  /** 各课时进度 */
  lessonProgress: LessonProgress[];
}

/**
 * 用户课程学习进度
 */
export interface UserCourseProgress {
  /** 用户 ID */
  userId: string;

  /** 课程 ID */
  courseId: string;

  /** 当前学习的课时 ID */
  currentLessonId?: string;

  /** 总体完成百分比（0-100） */
  overallProgress: number;

  /** 各模块进度 */
  moduleProgress: ModuleProgress[];

  /** 最后学习时间 */
  lastAccessedAt: Date;

  /** 总学习时长（分钟） */
  totalTimeSpentMinutes: number;

  /** 获得的成就/徽章（可选） */
  achievements?: string[];
}

// ===== MDX 组件相关类型 =====

/**
 * SlideSection 组件属性
 */
export interface SlideSectionProps {
  /** 模式：teacher（广播）或 student（跟随） */
  mode?: 'teacher' | 'student';

  /** 幻灯片索引 */
  index?: number;

  /** 标题（可选） */
  title?: string;

  /** 子内容 */
  children: React.ReactNode;
}

/**
 * Scene3D 组件属性
 */
export interface Scene3DProps {
  /** 3D 模型标识 */
  model: string;

  /** 场景高度（可选） */
  height?: number | string;

  /** 是否允许交互（可选） */
  interactive?: boolean;

  /** 初始相机位置（可选） */
  cameraPosition?: [number, number, number];
}

/**
 * MathCanvas 组件属性
 */
export interface MathCanvasProps {
  /** 画布类型 */
  type: 'block-diagram' | 'signal-flow';

  /** 初始数据（可选） */
  initialData?: Record<string, unknown>;

  /** 是否只读 */
  readonly?: boolean;

  /** 变更回调 */
  onChange?: (data: Record<string, unknown>) => void;
}

/**
 * Plotter 组件属性
 */
export interface PlotterProps {
  /** 图表类型 */
  type: 'bode' | 'nyquist' | 'root-locus' | 'step-response' | 'impulse-response';

  /** 传递函数数据（可选） */
  transferFunction?: {
    numerator: number[];
    denominator: number[];
  };

  /** 是否显示网格 */
  showGrid?: boolean;

  /** 交互配置（可选） */
  interactive?: boolean;
}

/**
 * SimulationPanel 组件属性
 */
export interface SimulationPanelProps {
  /** 仿真场景标识 */
  scenario: string;

  /** 初始参数（可选） */
  initialParams?: Record<string, number>;

  /** 是否显示控制面板 */
  showControls?: boolean;

  /** 仿真完成回调 */
  onComplete?: (result: SimulationResult) => void;
}

/**
 * 仿真结果
 */
export interface SimulationResult {
  /** 是否成功 */
  success: boolean;

  /** 得分 */
  score?: number;

  /** 性能指标 */
  metrics?: Record<string, number>;

  /** 伦理违规记录 */
  violations?: Array<{
    type: string;
    timestamp: number;
    description: string;
  }>;
}
