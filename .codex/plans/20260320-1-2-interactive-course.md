# 1-2 Interactive Course Implementation Plan

> **For Codex:** 先按 TDD 锁住课程注册、runtime 首页和 session framework 约束，再最小实现 1-2 的互动课程骨架与 17 步课堂内容。

**Goal:** 为 `1-2` 落地完整精品互动课，覆盖课程入口、教师端/学生端课堂页、17 个步骤、页内 AI、统一事件链、预置教案与 runtime-first 首页导学。

**Architecture:** 以 `course-content/runtime/lessons/legacy/1-2` 作为讲义、知识图、知识卡和审查报告唯一运行时来源；以 `course-content/authoring/lessons/legacy/1-2/design/interactive-page.md` 的 17 步为页面设计真源；以 `1-1` 为课程注册、双端会话和内容面板基线，以 `L-sum` 为理论课反馈闭环与页内 AI 交互基线。

**Tech Stack:** Next.js 14、TypeScript、React Client Components、现有 session framework、runtime lesson bundle、全局 AI provider、统一课程事件链

### Task 1: 固定 1-2 的课程注册与 runtime 入口契约

**Files:**
- Create: `scripts/tests/test-1-2-course-registration.ts`
- Create: `scripts/tests/test-1-2-session-framework-adoption.ts`
- Create: `scripts/tests/test-1-2-entry-runtime-content.ts`

**Step 1:** 写失败测试，断言新增 `src/lib/unit-1-2-course.ts`，并导出固定路由段、课程标题、17 步步骤清单和精品课程卡片。

**Step 2:** 写失败测试，断言互动课程目录、预置教案索引、课堂码路由解析、入口/教师/学生路由都注册 `1-2`。

**Step 3:** 写失败测试，断言 `1-2` 入口路由调用 `loadLessonRuntimeEntry('1-2')`，入口页接收 runtime bundle，并把教师入口 / 自由浏览 / 学生入口放在 runtime 导学模块之前。

**Step 4:** 写失败测试，断言教师/学生页接入统一 `useTeacherLessonSession`、`useStudentLessonSession`、`useCourseEventTracking` 和全局 AI page context，而不是页面内直接 fetch state。

### Task 2: 实现 1-2 课程注册与课程级配置

**Files:**
- Create: `src/lib/unit-1-2-course.ts`
- Create: `src/lib/unit-1-2-ai-contexts.ts`
- Modify: `src/lib/course-ai-contexts.ts`
- Modify: `src/features/interactive/learning-catalog.ts`
- Modify: `src/lib/classroom-session-route.ts`
- Create: `src/features/teacher/preset-lessons/presets/unit-1-2-block-diagram-simplification.ts`
- Modify: `src/features/teacher/preset-lessons/presets/index.ts`

**Step 1:** 定义 `1-2` 路由段、课程标题、课程描述、17 步步骤配置、session adapter、媒体映射、精品课程卡片。

**Step 2:** 为 17 个步骤补齐 AI context，覆盖公式推导、等效变换、代数化简、AI 验证、梅森公式和总结反思。

**Step 3:** 注册互动课程目录、课堂码路由解析和预置教案，确保教师可直接建课。

### Task 3: 落地 runtime-first 首页与课堂路由

**Files:**
- Create: `src/app/interactive-learning/courses/unit-1-2-block-diagram-simplification/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-1-2-block-diagram-simplification/student/[sessionId]/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-1-2-block-diagram-simplification/teacher/[sessionId]/page.tsx`
- Create: `src/features/interactive/unit-1-2-structure-graph/course-header.tsx`
- Create: `src/features/interactive/unit-1-2-structure-graph/entry-page.tsx`
- Create: `src/features/interactive/unit-1-2-structure-graph/student-page.tsx`
- Create: `src/features/interactive/unit-1-2-structure-graph/teacher-page.tsx`

**Step 1:** 复用 `LessonEntryRuntimeSections` 实现 1-2 首页，明确承接 `1-1 -> 1-2 -> 1-3` 的课程链。

**Step 2:** 落地学生/教师双端路由守卫，非登录或角色不匹配时按现有精品课模式跳转。

**Step 3:** 学生/教师页接入统一 session framework、统一课程事件和步骤级 AI 上下文更新。

### Task 4: 落地 17 步内容、互动表单与教师反馈闭环

**Files:**
- Create: `src/features/interactive/unit-1-2-structure-graph/step-panels.tsx`

**Step 1:** 把 17 步拆成内容蓝图、活动定义和教师汇总配置，优先用现有媒体 `sh-01` 到 `sh-04`。

**Step 2:** 覆盖前测、三种基本连接练习、等效变换练习、AI 对照页、后测和总结页，保留教师释放活动 / 显示答案 / 回复列表。

**Step 3:** 用内容面板和轻量前端动画表达 `ic-*` 占位资源，不额外引入新的媒体文件依赖。

### Task 5: 闭环核对与验证

**Files:**
- Modify: `.codex/skills/interactive-lesson-implementation/notes/1-2.md`

**Step 1:** 跑 1-2 定向测试并确认从失败转绿。

**Step 2:** 跑 `npm run lint`、`npm run test`、`npm run build`。

**Step 3:** 回到课程笔记补齐“当前状态 / 差异 / 验证记录 / 下一步建议”。
