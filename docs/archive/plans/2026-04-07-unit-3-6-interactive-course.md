# 3-6 Interactive Course Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `3-6：零点作用与动态改善实验——从性能目标到校正设计` 落地完整的 runtime-first 精品互动课程，包含统一入口页、教师端、学生端、AI 上下文、预置教案、路由注册与回归测试。

**Architecture:** 以 `course-content/runtime/lessons/3-6/*` 为运行时输入，以 `course-content/authoring/lessons/3-6/design/interactive-page.md` 与 `interactive-contract.yaml` 为本地契约来源，沿用 `3-5` 的师生端会话框架与 `2-1` 的统一预习台模板。新实现将通过 `src/lib/unit-3-6-course.ts` 描述步骤、页面契约、媒体映射与同步类型，再由 `src/features/interactive/unit-3-6-zero-design-workshop/*` 提供入口页、课堂页与工作区渲染。

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, NextAuth, interactive session framework, Vitest, runtime lesson bundle.

### Task 1: 固定设计对照与测试入口

**Files:**
- Create: `notes/3-6.md`
- Create: `src/features/interactive/__tests__/unit-3-6-course.test.ts`

**Step 1: 写失败测试**

- 校验 `COURSE_AI_CONTEXT_REGISTRY` 中存在 `unit-3-6-zero-design-workshop-v1`
- 校验 `UNIT_3_6_LESSON_STEPS` 为 13 步
- 校验代表性步骤与作者态 `interactive-contract.yaml` 一致
- 校验媒体映射引用真实 `3-6-*` runtime 资源
- 校验入口页复用 `LessonEntryMediaHub` 与 `LessonEntryRuntimeSections`

**Step 2: 运行失败测试**

Run: `npx vitest run src/features/interactive/__tests__/unit-3-6-course.test.ts`

Expected: FAIL，原因是 `unit-3-6` 相关模块尚未实现。

**Step 3: 固化对照表**

- 在 `notes/3-6.md` 中写明 13 步页面模板、互动类型、埋点摘要、教师聚合与接线缺口

### Task 2: 建立 3-6 课程定义与 AI 上下文

**Files:**
- Create: `src/lib/unit-3-6-course.ts`
- Create: `src/lib/unit-3-6-ai-contexts.ts`
- Modify: `src/lib/course-ai-contexts.ts`
- Modify: `src/lib/classroom-session-route.ts`

**Step 1: 定义课程元数据**

- 路由段、preset key、resource key、lesson key
- 13 步 `stage / title / hint / duration / pageType`
- 本地页面契约、媒体映射、session adapter、teacher sync / finalize helper
- 导出 premium lesson card

**Step 2: 注册 AI 上下文**

- 为每一步补 `topic`、`learningObjectives`、`quickQuestions`、`systemPromptExtension`
- 将课程注册到统一 AI registry

**Step 3: 运行针对性测试**

Run: `npx vitest run src/features/interactive/__tests__/unit-3-6-course.test.ts`

### Task 3: 落地 3-6 入口页与课堂页

**Files:**
- Create: `src/features/interactive/unit-3-6-zero-design-workshop/course-header.tsx`
- Create: `src/features/interactive/unit-3-6-zero-design-workshop/entry-page.tsx`
- Create: `src/features/interactive/unit-3-6-zero-design-workshop/student-page.tsx`
- Create: `src/features/interactive/unit-3-6-zero-design-workshop/teacher-page.tsx`
- Create: `src/features/interactive/unit-3-6-zero-design-workshop/step-panels.tsx`
- Create: `src/features/interactive/unit-3-6-zero-design-workshop/workspace.ts`
- Create: `src/app/interactive-learning/courses/unit-3-6-zero-design-workshop/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-3-6-zero-design-workshop/student/[sessionId]/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-3-6-zero-design-workshop/teacher/[sessionId]/page.tsx`

**Step 1: 先复用 3-5 / 2-1 稳定骨架**

- 保留统一课堂事件、知识抽屉、demo 路由与 teacher sync 机制
- 入口页复用共享预习台与 runtime 知识区组件，不回读作者态

**Step 2: 实现 3-6 页面渲染**

- 按双轨设计承载 13 步静态内容、公式、图示、表格与任务链
- 为 `single_choice / quiz_group / categorize_and_confirm / workspace_builder / parameter_workspace / structured_compare / decision_submit / exit_reflection` 提供真实可操作组件
- 学生页按契约锁定前测/后测 AI 边界，教师端支持释放、揭示、汇总与结束课堂

**Step 3: 本地检查**

Run: `npx vitest run src/features/interactive/__tests__/unit-3-6-course.test.ts`

### Task 4: 接入目录、预置教案与路由

**Files:**
- Create: `src/features/teacher/preset-lessons/presets/unit-3-6-zero-design-workshop.ts`
- Modify: `src/features/teacher/preset-lessons/presets/index.ts`
- Modify: `src/features/interactive/learning-catalog.ts`
- Modify: `src/lib/classroom-session-route.ts`

**Step 1: 注册精品课程卡片**

- 在课程总览中加入 `3-6`

**Step 2: 注册预置教案**

- 把 13 步映射为课堂资源编排

**Step 3: 回归测试**

Run: `npx vitest run src/features/interactive/__tests__/unit-3-6-course.test.ts src/features/interactive/__tests__/learning-catalog.test.ts`

### Task 5: 验证、审查与文档更新

**Files:**
- Modify: `docs/ProjectDescription.md`
- Optionally Modify: `.codex/memory/*`

**Step 1: 契约与审查验证**

Run: `python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --contract course-content/authoring/lessons/3-6/design/interactive-contract.yaml --implementation src/lib/unit-3-6-course.ts --page-contract-const UNIT_3_6_PAGE_CONTRACTS --step-const UNIT_3_6_LESSON_STEPS`

Run: `python3 course-content/scripts/review_lesson_content.py --lesson 3-6 --strict-implementation-contract`

**Step 2: 运行基础验证**

Run: `npm run lint`

Run: `npm run test`

**Step 3: 更新项目说明**

- 记录 `3-6` 精品互动课已接入的范围、入口与统一模板复用情况
