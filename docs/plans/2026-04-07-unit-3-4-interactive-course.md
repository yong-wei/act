# Unit 3-4 Interactive Course Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 落地 `3-4：根轨迹读图与对象化验证` 的 runtime-first 精品互动课，实现统一入口资源、统一课堂事件、步骤级 AI 上下文与教师聚合。

**Architecture:** 以 `course-content/authoring/lessons/3-4/design/interactive-page.md` 和 `interactive-contract.yaml` 为真源，复用 `3-3` 精品课代码骨架，新增 `unit-3-4-course.ts` 作为课程平行契约与会话适配中心，再接入 `entry/student/teacher` 页面、课程目录、预置教案、课堂路由和 AI 注册。实现中优先复用共享入口页和共享课堂同步能力，仅在 `step-panels.tsx` 与 `workspace.ts` 内做 3-4 特有工作区扩展。

**Tech Stack:** Next.js 14、TypeScript、Tailwind、Vitest、runtime lesson bundle、统一会话框架与课程事件链。

### Task 1: 落地设计对照与课程接入测试

**Files:**
- Create: `course-content/authoring/lessons/3-4/notes/interactive-implementation.md`
- Create: `src/features/interactive/__tests__/unit-3-4-course.test.ts`
- Reference: `course-content/authoring/lessons/3-4/design/interactive-contract.yaml`
- Reference: `src/features/interactive/__tests__/unit-3-3-course.test.ts`

**Step 1: 写对照表与接入测试**

- 对照表先列出 14 步页面模板、交互类型、教师洞察和当前缺口。
- 测试至少覆盖：
  - AI 注册项存在
  - 14 步课程流定义存在
  - 代表步骤与作者态契约对齐
  - 学习目录与课堂路由接入
  - 入口页复用 runtime 媒体组件
  - runtime `3-4-media.md` 解析正确

**Step 2: 运行测试确认失败**

Run: `npx vitest run src/features/interactive/__tests__/unit-3-4-course.test.ts`

Expected: 因 `unit-3-4` 课程模块、页面和注册点尚不存在而失败。

### Task 2: 实现课程定义与 AI 上下文

**Files:**
- Create: `src/lib/unit-3-4-course.ts`
- Create: `src/lib/unit-3-4-ai-contexts.ts`
- Modify: `src/lib/course-ai-contexts.ts`

**Step 1: 实现课程定义**

- 复制 `3-3` 课程模块结构，改为 `3-4` 路由段、预置键、课程标题和 14 步定义。
- 页面契约严格映射作者态契约，不擅自改模板名、区域或 telemetry。
- 提供 `getUNIT_3_4MediaSrc`、interactive/ai page type 判断、teacher sync state 与 session adapter。

**Step 2: 实现步骤级 AI 上下文**

- 为 14 步配置 `topic / learningObjectives / quickQuestions / forbidden scope`。
- 特别守住 `step-10 / step-12` 的 AI 禁区：只检查链条，不直接代做排序和最终结论。

**Step 3: 运行目标测试**

Run: `npx vitest run src/features/interactive/__tests__/unit-3-4-course.test.ts`

Expected: 仍会失败，但应从“模块缺失”推进到“页面/注册点缺失”。

### Task 3: 实现 3-4 页面目录与路由

**Files:**
- Create: `src/features/interactive/unit-3-4-root-locus-reading-validation/entry-page.tsx`
- Create: `src/features/interactive/unit-3-4-root-locus-reading-validation/student-page.tsx`
- Create: `src/features/interactive/unit-3-4-root-locus-reading-validation/teacher-page.tsx`
- Create: `src/features/interactive/unit-3-4-root-locus-reading-validation/course-header.tsx`
- Create: `src/features/interactive/unit-3-4-root-locus-reading-validation/step-panels.tsx`
- Create: `src/features/interactive/unit-3-4-root-locus-reading-validation/workspace.ts`
- Create: `src/app/interactive-learning/courses/unit-3-4-root-locus-reading-validation/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/[sessionId]/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-3-4-root-locus-reading-validation/teacher/[sessionId]/page.tsx`

**Step 1: 入口页**

- 复用 `LessonEntryMediaHub` 与 `LessonEntryRuntimeSections`
- 课程说明文案围绕“关键节点 -> 参数窗口 -> 增益换算 -> 三域验证”

**Step 2: 学生页 / 教师页**

- 复用会话同步、步骤跟随、知识卡抽屉、统一事件追踪
- 学生页更新 `useGlobalAI().updatePageContext`
- 教师页保留释放活动、揭示答案、学生汇总与结束课堂

**Step 3: step-panels 与 workspace**

- 把 3-4 的 8 个核心互动步骤落到现有轻量工作区模式
- 不做重型画布组件；优先文本、标签、切换、表格、提交态、教师聚合

### Task 4: 接入课程注册点

**Files:**
- Create: `src/features/teacher/preset-lessons/presets/unit-3-4-root-locus-reading-validation.ts`
- Modify: `src/features/teacher/preset-lessons/presets/index.ts`
- Modify: `src/features/interactive/learning-catalog.ts`
- Modify: `src/lib/classroom-session-route.ts`

**Step 1: 预置教案**

- 参考 `unit-3-3-root-locus-rules` 预置教案，映射 `classroom-objective / classroom-assessment / classroom-ai-report`

**Step 2: 课程目录与路由**

- 在 `FEATURED_LESSONS` 和模块 3 课程列表中加入 `3-4`
- 在 `resolveSessionRouteFromPlanTitle` 中加入 `3-4` 标题别名

### Task 5: 收口验证与文档

**Files:**
- Modify: `docs/ProjectDescription.md`

**Step 1: 契约对齐校验**

Run: `python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --lesson 3-4`

Expected: 14 步契约字段对齐通过。

**Step 2: 测试与静态检查**

Run:
- `npx vitest run src/features/interactive/__tests__/unit-3-4-course.test.ts`
- `npm run lint`
- `npm run test`

Expected: 新增课程接入测试通过；全局 lint/test 无回归。

**Step 3: 更新项目说明**

- 在 `docs/ProjectDescription.md` 记录 `3-4` 精品互动课已接入统一课程框架、统一入口资源与统一埋点。
