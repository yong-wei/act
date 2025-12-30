技术规格书：弹性课堂编排引擎与资源池架构Technical Specification: Elastic Lesson Engine & Atomic Resource Pool1. 核心设计理念 (Architecture Overview)本项目旨在构建一个去PPT化的、基于Web的全互动教学系统。核心架构模式为 "Atomic Resources + Linear Playlist"（原子资源 + 线性播放列表）。资源池 (Resource Pool): 存放独立的知识点、互动组件、测验题。它们是无状态或弱状态的。课程流 (Lesson Stream): 定义一节课的叙事逻辑。它是一个有序引用的列表，通过**"上下文注入 (Context Injection)"** 技术，赋予原子资源在特定环节的教学意义。2. 数据层架构 (Data Schema)这是系统的核心。请在 types/schema.ts 中严格定义以下接口，以保证课程内容的弹性和可重用性。2.1 原子资源定义 (Atomic Resources)export type ResourceType = 'concept' | 'widget' | 'quiz' | 'video';

export interface ResourceBase {
  id: string;          // e.g., "concept-newton-second-law"
  type: ResourceType;
  title: string;       // 默认标题
  tags: string[];      // 用于知识图谱关联 e.g., ["physics", "modeling"]
  metadata?: Record<string, any>;
}

// 1. 静态概念卡片 (MDX)
export interface ConceptResource extends ResourceBase {
  type: 'concept';
  contentPath: string; // 指向 content/concepts/xxx.mdx
}

// 2. 交互组件 (React Component)
export interface WidgetResource extends ResourceBase {
  type: 'widget';
  componentName: string; // e.g., "PhysicsBuilder"
  defaultProps: Record<string, any>; // 默认配置
}

// 3. 测验/探针
export interface QuizResource extends ResourceBase {
  type: 'quiz';
  questions: Array<{
    id: string;
    stem: string; // 题干
    options: string[];
    correctIndex: number;
    explanation?: string;
  }>;
}

export type Resource = ConceptResource | WidgetResource | QuizResource;
2.2 课程流定义 (Lesson Stream)export interface LessonManifest {
  id: string;          // e.g., "lesson-03-modeling"
  title: string;
  description: string;
  durationMinutes: number;
  steps: LessonStep[]; // 有序的教学环节
}

export interface LessonStep {
  id: string;          // 步骤唯一ID
  resourceId: string;  // 引用资源池中的ID
  
  // *** 核心机制：上下文注入 ***
  // 在本步骤中，覆盖资源的默认属性
  context: {
    titleOverride?: string;       // 修改显示的标题
    descriptionOverride?: string; // 本步骤的特定引导语 (Teacher script)
    
    // 注入给组件的 Props (关键！)
    // e.g., PhysicsBuilder 在此步骤只能用 "mechanical" 模式
    propsOverride?: Record<string, any>; 
    
    // AI 助教在本步骤的“人设”
    aiAgentConfig?: {
      persona: 'tutor' | 'critic' | 'analyst';
      systemPromptExtension?: string;
    };
  };

  // 布局配置
  layout?: 'full' | 'split-left' | 'split-right' | 'drawer';
}
3. 核心组件架构 (Component Architecture)请在 components/lesson-engine 目录下实现以下核心引擎。3.1 LessonPlayer (主控制器)这是课堂的主视图。State Management (Zustand):currentStepIndex: numbertotalSteps: numberisTeacherMode: boolean功能需求:读取 LessonManifest。渲染顶部/底部的进度导航条 (Timeline Scrubber)，允许非线性跳转。根据当前 step 的 layout 属性，决定渲染容器结构。3.2 ResourceRenderer (渲染分发器)这是根据资源类型渲染具体内容的工厂组件。// 伪代码示例
export const ResourceRenderer = ({ step, resource }:Props) => {
  // 合并默认 Props 和 覆盖 Props
  const finalProps = { ...resource.defaultProps, ...step.context.propsOverride };

  switch (resource.type) {
    case 'concept':
      return <MDXViewer path={resource.contentPath} extraContext={finalProps} />;
    case 'widget':
      // 动态加载组件库
      const Widget = ComponentRegistry[resource.componentName];
      return <Widget {...finalProps} />;
    case 'quiz':
      return <QuizEngine data={resource} />;
  }
}
3.3 ContextInjector (上下文注入器)一个高阶组件或 Wrapper，负责将 step.context 中的信息（如引导语、AI 提示）注入到 UI 外围。UI 表现:在主内容上方或侧边显示 descriptionOverride (引导语)。向全局 AIProvider 推送当前的 aiAgentConfig，确保 AI 知道当前在讲什么。4. 内容管理与文件结构 (File Structure)建立清晰的 CMS 目录结构，便于后期维护。/content
  /concepts           # [MDX] 静态知识卡片
    newton-laws.mdx
    laplace-transform.mdx
  /quizzes            # [JSON] 题库
    modeling-basics.json
  /manifests          # [JSON] 课程编排文件
    lesson-03.json
    lesson-04.json

/components
  /widgets            # [React] 交互组件库
    /PhysicsBuilder
    /LaplaceLens
    /Plotter
5. 课堂同步设施 (Classroom Sync Infrastructure)为了支持线下课堂的“师生同频”，需要实现简单的 WebSocket/Realtime 逻辑。技术选型: Supabase Realtime 或 Socket.io功能需求:Teacher Broadcaster:当教师端的 currentStepIndex 改变时，向频道 classroom_session_{id} 广播事件 SYNC_STEP。Student Receiver:学生端监听 SYNC_STEP。如果开启了“跟随模式 (Follow Mode)”，自动跳转到对应 Index。学生可以主动点击“自由探索 (Unlink)”，脱离广播独自翻页。6. 开发与验收指南 (Development & Acceptance)阶段 1: 引擎原型 (The Engine)Prompt 指令:"请根据技术规格书，初始化 types/schema.ts。然后创建一个 LessonPlayer 组件，使用 Mock 数据（一个包含 3 个步骤的 Lesson），实现基础的 '上一步/下一步' 切换和 'ResourceRenderer' 分发逻辑。暂时只支持 'concept' (显示简单文本) 和 'widget' (显示一个空的占位符) 类型。"验收标准:[ ] 可以通过 JSON 配置定义一个包含 3 个步骤的课程。[ ] 点击“下一步”能正确切换显示的标题和内容。阶段 2: 资源集成 (The Content)Prompt 指令:"实现 MDXViewer 组件，使用 next-mdx-remote 加载 /content/concepts 下的文件。同时，在 components/widgets 下创建一个简单的 PhysicsBuilder Demo 组件。更新 LessonPlayer，使其能正确渲染 MDX 内容和传递 Props 给 PhysicsBuilder。"验收标准:[ ] MDX 文件中的 LaTeX 公式能正确渲染。[ ] 在 JSON 中配置 propsOverride: { mode: 'electrical' }，PhysicsBuilder 组件能接收并打印该 Prop。阶段 3: 课堂同步 (The Sync)Prompt 指令:"使用 Supabase Realtime 实现 useClassroomSync Hook。它应该包含 broadcastStep(index) 方法和 onStepChange(callback) 监听器。将其集成到 LessonPlayer 中。"验收标准:[ ] 打开两个浏览器窗口。一个作为教师点击翻页，另一个作为学生能自动跟随翻页。