这份文档是专门为您正在使用的**编程AI（如 Cursor, Windsurf, GitHub Copilot）准备的。它将教育理念转化为软件工程规范**。

你可以将以下内容直接复制粘贴给AI，作为项目的**“技术宪法”**。它定义了系统的骨架，确保后续填充60学时内容时，系统不会崩塌。

---

# AI-OBE 船舶智控全互动平台：技术架构与开发规范 (Technical Specification)

## 1. 项目愿景与技术背景 (Context)

本项目旨在构建一个**“去PPT化”**的新一代《自动控制原理》教学平台。系统需支持60学时的全互动教学，集成了数字孪生仿真、AI Agent 辅助、实时数据分析和即时交互课件。

* **核心栈:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Shadcn UI.
* **状态管理:** Zustand (客户端仿真状态), TanStack Query (服务端数据).
* **AI 引擎:** Vercel AI SDK (OpenAI/Azure).
* **可视化:** React Flow (拓扑图), Recharts/Maifs (图表), Three.js/R3F (3D场景).
* **数据库:** PostgreSQL (Prisma ORM).

---

## 2. 核心模块一：弹性课程引擎 (Flexible Curriculum Engine)

**需求描述：**
我们需要一个基于配置文件的课程管理系统，能够动态渲染 30 个 Lesson 模块。每个 Lesson 不是静态页面，而是一个由“交互原子”组成的流式文档。

### 2.1 数据结构定义 (Interfaces)

请在 `types/curriculum.ts` 中定义以下核心接口，用于支撑 60 学时的弹性编排：

```typescript
// 课程模块结构
export type ModuleId = 'introduction' | 'modeling' | 'time-domain' | 'frequency-domain' | 'design' | 'nonlinear';

export interface CourseModule {
  id: ModuleId;
  title: string;
  lessons: LessonConfig[];
}

export interface LessonConfig {
  id: string; // e.g., 'lesson-03-differential-equations'
  title: string;
  durationMinutes: number; // e.g., 90
  type: 'theory' | 'workshop' | 'battle' | 'review';
  // MDX 文件路径，指向 content/lessons/xxx.mdx
  contentPath: string; 
  // 该课程需要的预加载资源（如 3D 模型 key）
  assets?: string[];
  // 该课程关联的 AI Agent 角色设定 ID
  aiPersonaId: 'analyst' | 'devil_advocate' | 'tutor';
}

```

### 2.2 MDX 渲染架构 (The "No-PPT" Engine)

请在 `components/mdx-engine` 下构建渲染器。我们需要在 Markdown 中直接调用复杂的交互组件。

**组件注册表 (Component Registry):**
必须实现 `MDXRemote` 或 `next-mdx-remote`，并注入以下自定义组件：

* `<SlideSection>`: 用于将长文档分割为类似 PPT 的“屏”。支持 `mode="teacher"` (广播) 和 `mode="student"` (跟随)。
* `<Scene3D model="..." />`: 加载 Three.js 模型的容器。
* `<MathCanvas type="block-diagram|signal-flow" />`: 基于 React Flow 的绘图板。
* `<Plotter type="bode|nyquist|root-locus" />`: 动态数学绘图仪。
* `<SimulationPanel scenario="..." />`: 嵌入式仿真控制器。

---

## 3. 核心模块二：通用仿真与交互设施 (Simulation Infrastructure)

**需求描述：**
为了支持从“微分方程”到“非线性控制”的广泛内容，我们需要一个**“可插拔”**的数学物理引擎，而不是为每一课写死代码。

### 3.1 统一仿真 Hook (`useControlSystem`)

请实现一个通用的 React Hook，用于驱动前端的实时计算。

```typescript
// hooks/useControlSystem.ts

interface SimulationConfig {
  // 物理模型定义：可以是传递函数(s域)或状态空间(t域)
  model: {
    type: 'transfer_function' | 'state_space' | 'nonlinear_script';
    params: Record<string, number>; // { K: 10, T: 2.5, zeta: 0.7 }
  };
  // 求解器设置
  solver: 'euler' | 'runge_kutta_4';
  stepSize: number; // dt
}

interface SimulationState {
  t: number;
  inputs: number[];
  outputs: number[];
  states: number[];
  // 伦理熔断标志
  safetyViolation: null | { type: string; message: string };
}

// 核心驱动逻辑
export const useControlSystem = (config: SimulationConfig) => {
  // 使用 requestAnimationFrame 实现实时仿真循环
  // 实现“伦理熔断”检测逻辑 (中间件模式)
  // 返回 { start, pause, reset, setParam, data }
};

```

### 3.2 交互组件库规范 (Interactive Widgets)

在 `components/widgets` 下开发以下“通用教具”：

1. **`ParameterSlider`**: 带实时波形预览的滑块。拖动时，不仅改变数值，还能向外抛出事件 `onValueChange` 给 AI。
2. **`TransferFunctionEditor`**: 一个允许用户输入分子分母多项式的 UI，能自动渲染 LaTeX 公式。
3. **`PoleZeroMap` (s-plane)**: 交互式复平面。允许拖动 `x` (极点) 和 `o` (零点)，并实时回调新的传递函数。

---

## 4. 核心模块三：AI Agent 深度集成架构

**需求描述：**
AI 不应只是一个右下角的聊天框。它需要具备**上下文感知 (Context-Aware)** 和 **功能调用 (Function Calling)** 能力。

### 4.1 全局 AI 上下文 (AI Context Provider)

请使用 React Context 构建 `AIProvider`，包裹整个应用。它需要实时收集以下信息并注入到 System Prompt 中：

* **CurrentLesson**: 当前正在学的章节。
* **SimulationStatus**: 当前仿真器的参数（如 , 震荡中）。
* **UserAction**: 用户的最近一次操作（如“触发了熔断”）。

### 4.2 AI 工具链定义 (Tool Definitions)

在 `lib/ai/tools.ts` 中定义 AI 可调用的函数，赋予 AI “手”：

```typescript
export const aiTools = {
  // 允许 AI 修改仿真参数（辅助设计）
  setSimulationParameters: tool({
    description: 'Update the control system parameters (K, T, etc.)',
    parameters: z.object({ ... }),
    execute: async ({ params }) => { ... } // 更新 Zustand store
  }),
  // 允许 AI 高亮界面上的某个区域（教学引导）
  highlightUIElement: tool({
    description: 'Highlight a specific UI component to guide the student',
    parameters: z.object({ elementId: z.string() }),
    execute: async ({ elementId }) => { ... }
  }),
  // 允许 AI 触发挑战模式
  triggerScenarioEvent: tool({
    description: 'Inject a disturbance or fault into the simulation',
    parameters: z.object({ type: z.enum(['storm', 'sensor_fail']) }),
  })
};

```

---

## 5. 核心模块四：课堂同步与数据看板 (Classroom Sync)

**需求描述：**
支持 30 人线下课堂的实时互动。教师端可控制进度，并查看全班数据。

### 5.1 实时同步层 (Realtime Layer)

利用 **Supabase Realtime** 或 **Socket.io** 实现 `ClassroomSession`。

* **Teacher Mode**: 教师点击“加载模型 A”，所有连接的学生端自动跳转到模型 A 视图。
* **State Broadcasting**: 学生端的仿真结果（如 `overshoot` 值）需以 1Hz 的频率节流上传，汇聚到教师大屏。

### 5.2 数据库 Schema 扩展 (Prisma)

```prisma
model ClassSession {
  id        String   @id @default(cuid())
  isActive  Boolean
  currentLessonId String?
  // 存储全班当前的聚合状态
  snapshot  Json?    
}

model StudentActivity {
  id        String   @id @default(cuid())
  studentId String
  lessonId  String
  // 记录关键里程碑：如“成功整定PID”、“触发伦理熔断”
  eventType String   
  payload   Json
  createdAt DateTime @default(now())
}

```

---

## 6. 开发路线图与验收标准 (Implementation Roadmap)

### 阶段一：基础架构 (Week 1-2)

* [ ] 搭建 MDX 渲染引擎，支持加载本地 `.mdx` 文件。
* [ ] 实现 `CourseLayout`，包含左侧目录树和右侧 AI 侧边栏。
* [ ] 集成 React Flow 和 Recharts，创建一个 Demo 页面（如“弹簧-质量”系统）。

### 阶段二：仿真核心 (Week 3-4)

* [ ] 完成 `useControlSystem` Hook，支持 Runge-Kutta 解算。
* [ ] 实现 **“伦理熔断”中间件**，当变量溢出时强制暂停并弹窗。
* [ ] 建立 `BlockDiagram` 组件，允许拖拽连接方框图。

### 阶段三：AI 赋能 (Week 5-6)

* [ ] 接入 Vercel AI SDK。
* [ ] 实现 Tool Calling：AI 可以帮你改参数。
* [ ] 实现 Context Injection：AI 知道你正在学哪一课。

---

**给 AI 编程助手的指令 (Prompt Example):**

> "作为一个高级全栈架构师，请根据上述《技术架构与开发规范》，首先为我初始化 `types/curriculum.ts` 和 `hooks/useControlSystem.ts` 的基础代码框架。请确保使用了 TypeScript 的强类型定义，并为仿真引擎预留了扩展非线性模型的能力。"