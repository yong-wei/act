# 2-3 Interactive Course Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `2-3：频率响应基础与 Bode 图初步` 落地完整的 runtime-first 精品互动课程，包含学生端、教师端、AI 上下文、预置教案与回归测试。

**Architecture:** 以 `course-content/runtime/lessons/2-3/*` 为运行时输入，以 `course-content/authoring/lessons/2-3/design/interactive-page.md` 和 `interactive-contract.yaml` 为本地契约来源，沿用 `2-2` 的师生端会话框架。新实现将通过 `src/lib/unit-2-3-course.ts` 描述步骤、契约、媒体映射与同步类型，再由 `src/features/interactive/unit-2-3-frequency-response/*` 提供页面渲染与交互组件。

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, NextAuth, 现有 interactive session framework, Vitest.

### Task 1: 固定设计对照与测试入口

**Files:**
- Create: `notes/2-3.md`
- Create: `src/features/interactive/__tests__/unit-2-3-course.test.ts`
- Modify: `src/features/interactive/__tests__/learning-catalog.test.ts`（如需要）

**Step 1: 写失败测试**

- 校验 `COURSE_AI_CONTEXT_REGISTRY` 中存在 `unit-2-3-frequency-response-bode-intro-v1`
- 校验 `UNIT_2_3_LESSON_STEPS` 为 17 步
- 校验代表性步骤与作者态 `interactive-contract.yaml` 一致
- 校验媒体映射引用真实 `2-3-*` runtime 资源

**Step 2: 运行失败测试**

Run: `npm run test -- src/features/interactive/__tests__/unit-2-3-course.test.ts`

**Step 3: 补 notes 对照表**

- 明确设计稿步骤、互动类型、实现切入点、验收口径

### Task 2: 建立 2-3 课程定义与 AI 上下文

**Files:**
- Create: `src/lib/unit-2-3-course.ts`
- Create: `src/lib/unit-2-3-ai-contexts.ts`
- Modify: `src/lib/course-ai-contexts.ts`
- Modify: `src/lib/classroom-session-route.ts`

**Step 1: 定义课程元数据**

- 路由段、preset key、resource key、lesson key
- 17 步 stage / title / hint / duration / pageType
- page contract、媒体映射、session adapter、teacher sync helper

**Step 2: 注册 AI 上下文**

- 为每一步补 topic、learningObjectives、knowledgeType、quickQuestions、systemPromptExtension
- 将课程注册到统一 AI registry

**Step 3: 运行针对性测试**

Run: `npm run test -- src/features/interactive/__tests__/unit-2-3-course.test.ts`

### Task 3: 落地 2-3 学生端、教师端与入口页

**Files:**
- Create: `src/features/interactive/unit-2-3-frequency-response/course-header.tsx`
- Create: `src/features/interactive/unit-2-3-frequency-response/entry-page.tsx`
- Create: `src/features/interactive/unit-2-3-frequency-response/student-page.tsx`
- Create: `src/features/interactive/unit-2-3-frequency-response/teacher-page.tsx`
- Create: `src/features/interactive/unit-2-3-frequency-response/step-panels.tsx`
- Create: `src/features/interactive/unit-2-3-frequency-response/workspace.ts`
- Create: `src/app/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/[sessionId]/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/teacher/[sessionId]/page.tsx`

**Step 1: 先复用 2-2 会话骨架**

- 保留统一课堂事件、知识抽屉、demo 路由与 teacher sync 机制

**Step 2: 实现 2-3 页面渲染**

- 以静态承载优先，确保公式、图示、表格、方法链先出现
- 为契约中的互动类型提供真实可操作组件
- 实现教师端聚合摘要与答案释放

**Step 3: 本地检查**

Run: `npm run lint -- --file src/features/interactive/unit-2-3-frequency-response/step-panels.tsx`

### Task 4: 接入目录与预置教案

**Files:**
- Create: `src/features/teacher/preset-lessons/presets/unit-2-3-frequency-response-bode-intro.ts`
- Modify: `src/features/teacher/preset-lessons/presets/index.ts`
- Modify: `src/features/interactive/learning-catalog.ts`

**Step 1: 注册精品课程卡片**

- 在课程总览、模块映射中加入 `2-3`

**Step 2: 注册预置教案**

- 把 17 步映射为课堂资源编排

**Step 3: 回归测试**

Run: `npm run test -- src/features/interactive/__tests__/unit-2-3-course.test.ts src/features/interactive/__tests__/learning-catalog.test.ts`

### Task 5: 验证、文档与收尾

**Files:**
- Modify: `docs/ProjectDescription.md`
- Optionally Modify: `.codex/memory/*`（若形成稳定记忆）

**Step 1: 运行验证**

Run: `npm run lint`
Run: `npm run test`

**Step 2: 如本地可启动则补人工验收**

Run: `npm run dev`
Expected: `/interactive-learning/courses/unit-2-3-frequency-response-bode-intro`

**Step 3: 更新项目说明**

- 记录 `2-3` 精品互动课已接入的范围与入口
