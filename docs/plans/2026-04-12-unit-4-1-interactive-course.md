# Unit 4-1 Interactive Course Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 落地 `4-1` runtime-first 精品互动课，实现统一入口页资源接线、课堂步骤契约、学生/教师双端、AI 上下文和课堂数据链路。

**Architecture:** 以 `course-content/authoring/lessons/4-1/design/interactive-page.md` 与 `interactive-contract.yaml` 为双轨真源，新建 `unit-4-1-course`/`unit-4-1-ai-contexts`/`unit-4-1-design-task-expression` 一整套课程实现，并复用 `2-4` 的入口页 runtime 媒体骨架与 `3-7`/`3-8` 的课堂步骤壳。`task_card_workspace` 作为 4-1 新增工作区类型补入本课 `step-panels`，不改动全局互动引擎。

**Tech Stack:** Next.js 14、TypeScript、Tailwind、Vitest、runtime lesson bundle、课堂会话框架。

### Task 1: 固化 4-1 对照表与落点

**Files:**
- Create: `notes/4-1.md`
- Read: `course-content/authoring/lessons/4-1/design/interactive-page.md`
- Read: `course-content/authoring/lessons/4-1/design/interactive-contract.yaml`
- Read: `course-content/runtime/lessons/4-1/lesson.json`
- Read: `src/lib/unit-3-7-course.ts`
- Read: `src/lib/unit-3-8-course.ts`
- Read: `src/features/interactive/unit-2-4-nyquist-margin-entry/entry-page.tsx`

**Step 1: 写对照表**

- 逐步记录 12 个步骤的模板、区域、互动类型、教师聚合、埋点摘要、AI 边界、预览路径。
- 标出本轮新增能力：`task_card_workspace`。

**Step 2: 确认文件切口**

- 课程元数据：`src/lib/unit-4-1-course.ts`
- AI 上下文：`src/lib/unit-4-1-ai-contexts.ts`
- 页面实现：`src/features/interactive/unit-4-1-design-task-expression/*`
- 路由/注册：`src/app/interactive-learning/courses/unit-4-1-design-task-expression/*`、`src/features/interactive/learning-catalog.ts`、`src/lib/classroom-session-route.ts`
- 预置教案：`src/features/teacher/preset-lessons/presets/unit-4-1-design-task-expression.ts`

### Task 2: 先写 failing tests

**Files:**
- Create: `src/features/interactive/__tests__/unit-4-1-course.test.ts`
- Modify: `src/features/interactive/__tests__/learning-catalog.test.ts`

**Step 1: 写课程契约测试**

- 断言 `UNIT_4_1_LESSON_STEPS` 为 12 步，`step-01` 到 `step-12` 完整。
- 断言代表性步骤的本地 `PAGE_CONTRACTS` 与作者态 `interactive-contract.yaml` 对齐。
- 断言 `COURSE_AI_CONTEXT_REGISTRY`、`FEATURED_LESSONS`、`resolveSessionRouteFromPlanTitle`、runtime 媒体解析和入口页共享资源中心接线。

**Step 2: 运行单测确认失败**

Run: `npm run test -- unit-4-1-course`

Expected: 因模块、常量和路由尚不存在而失败。

### Task 3: 实现课程元数据与运行时契约

**Files:**
- Create: `src/lib/unit-4-1-course.ts`
- Create: `src/lib/unit-4-1-ai-contexts.ts`
- Modify: `src/lib/course-ai-contexts.ts`
- Modify: `src/features/interactive/learning-catalog.ts`
- Modify: `src/lib/classroom-session-route.ts`

**Step 1: 写 `unit-4-1-course.ts`**

- 定义路由、preset key、resource key、课程标题、副标题、步骤、page contracts、媒体映射、学生/教师状态判定与会话 adapter。
- 让 12 步标题、互动类型、预览路径严格匹配作者态契约。

**Step 2: 写 `unit-4-1-ai-contexts.ts`**

- 按步骤配置 topic、learning objectives、quick questions、system prompt extension。
- 在 `src/lib/course-ai-contexts.ts` 中注册课程。

**Step 3: 接课程目录与课堂路由**

- 注册 learning catalog 卡片。
- 在 classroom route resolver 中加入 4-1 标题和别名匹配。

### Task 4: 实现 4-1 页面与入口页

**Files:**
- Create: `src/features/interactive/unit-4-1-design-task-expression/entry-page.tsx`
- Create: `src/features/interactive/unit-4-1-design-task-expression/course-header.tsx`
- Create: `src/features/interactive/unit-4-1-design-task-expression/student-page.tsx`
- Create: `src/features/interactive/unit-4-1-design-task-expression/teacher-page.tsx`
- Create: `src/features/interactive/unit-4-1-design-task-expression/step-panels.tsx`
- Create: `src/features/interactive/unit-4-1-design-task-expression/workspace.ts`
- Create: `src/app/interactive-learning/courses/unit-4-1-design-task-expression/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-4-1-design-task-expression/student/[sessionId]/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-4-1-design-task-expression/teacher/[sessionId]/page.tsx`

**Step 1: 入口页**

- 复用 `LessonEntryMediaHub` + `LessonEntryRuntimeSections`。
- 按 `2-1/2-4` 模式接 teacher / browse / student 入口。
- 保持课堂外资源埋点链路，不硬编码 runtime 外链。

**Step 2: 学生/教师页**

- 复用统一课堂会话框架、课程事件、AI 上下文更新与答案揭示流程。
- 学生页默认使用学生演示页作为预览链路。

**Step 3: `step-panels.tsx` 与 `workspace.ts`**

- 静态内容严格覆盖 12 步模板中的固定文案、表、公式、图示。
- 复用 `quiz_group`、`triple_match`、`card_sort`、`binary_choice`、`structured_compare`。
- 新增 `task_card_workspace`：包含案例选择、六字段填写、证据来源和优先级检查。

### Task 5: 接预置教案与页面路由

**Files:**
- Create: `src/features/teacher/preset-lessons/presets/unit-4-1-design-task-expression.ts`
- Modify: `src/features/teacher/preset-lessons/presets/index.ts`

**Step 1: 新增 preset**

- 依据 12 步生成预置教案项，使用课堂 objective / assessment / AI report 的既有 registry 规则。

**Step 2: 路由页接线**

- 新增 4-1 入口页、教师页、学生页 server wrapper。
- 演示模式仍走 `/student/demo?step=...`。

### Task 6: 验证并补文档

**Files:**
- Modify: `docs/ProjectDescription.md`

**Step 1: 跑测试**

Run: `npm run test -- unit-4-1-course`
Expected: PASS

Run: `npm run test`
Expected: PASS

Run: `npm run lint`
Expected: PASS

Run: `npm run build`
Expected: PASS

**Step 2: 浏览器抽查**

- 启动本地服务，检查 4-1 入口页、学生 demo 页、教师页骨架与控制台。

**Step 3: 更新项目说明**

- 在 `docs/ProjectDescription.md` 记录 4-1 精品互动课已接入的课程壳、入口页和契约实现范围。
