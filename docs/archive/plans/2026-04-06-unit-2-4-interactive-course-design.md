# Unit 2-4 Interactive Course Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 落地 `2-4：Nyquist 图与频域指标入口` 的 runtime-first 精品互动课，完整接入入口页、教师页、学生页、课程定义、AI 上下文、目录、预置教案与课堂路由。

**Architecture:** 以 `course-content/authoring/lessons/2-4/design/interactive-page.md` 和 `interactive-contract.yaml` 作为双轨真源，以 `course-content/runtime/lessons/2-4/*` 作为运行时内容来源，复用 `2-3` 的精品互动课壳层、会话同步、事件治理和页内 AI。实现侧在 `src/lib/unit-2-4-course.ts` 维护本地课程定义与平行契约，在 `src/features/interactive/unit-2-4-nyquist-margin-entry/` 实现入口页、教师页、学生页和步骤面板，并同步注册课程目录、课堂路由、AI 上下文与预置教案。

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Vitest, runtime lesson bundle, course AI registry, preset lesson clone flow.

### Task 1: 建立实现前对照与测试入口

**Files:**
- Create: `course-content/authoring/lessons/2-4/notes/interactive-implementation.md`
- Create: `docs/plans/2026-04-06-unit-2-4-interactive-course-design.md`
- Create: `.codex/plans/2026-04-06-unit-2-4-interactive-course.md`
- Create: `src/features/interactive/__tests__/unit-2-4-course.test.ts`

**Step 1: 写失败测试**

- 断言 `COURSE_AI_CONTEXT_REGISTRY` 中存在 `unit-2-4-nyquist-margin-entry-v1`
- 断言 `UNIT_2_4_LESSON_STEPS` 有 17 步且首尾正确
- 断言 `UNIT_2_4_PAGE_CONTRACTS` 对代表步骤与作者态契约一致
- 断言媒体路径使用真实 `2-4-*` 资源名

**Step 2: 运行失败测试**

Run: `npx vitest run src/features/interactive/__tests__/unit-2-4-course.test.ts`

Expected: 因 `2-4` 尚未注册、课程定义文件不存在而失败。

### Task 2: 建立 2-4 课程定义与 AI 真源

**Files:**
- Create: `src/lib/unit-2-4-course.ts`
- Create: `src/lib/unit-2-4-ai-contexts.ts`
- Modify: `src/lib/course-ai-contexts.ts`

**Step 1: 最小实现课程元数据**

- 新建 `2-4` 路由段、课程标题、预置 key、资源 key、步骤数组、平行契约、媒体映射与会话 adapter
- 从作者态契约收紧步骤标题、模板、region、interactionKind、教师洞察、telemetry 和预览路径
- 建立 `2-4` 步骤级 AI context 与 quick questions，并注册到统一 AI registry

**Step 2: 运行定向测试**

Run: `npx vitest run src/features/interactive/__tests__/unit-2-4-course.test.ts`

Expected: 课程定义与 AI 注册相关断言转绿；页面/路由相关断言若尚未接入可继续失败。

### Task 3: 落地 2-4 页面壳层与步骤面板

**Files:**
- Create: `src/features/interactive/unit-2-4-nyquist-margin-entry/entry-page.tsx`
- Create: `src/features/interactive/unit-2-4-nyquist-margin-entry/student-page.tsx`
- Create: `src/features/interactive/unit-2-4-nyquist-margin-entry/teacher-page.tsx`
- Create: `src/features/interactive/unit-2-4-nyquist-margin-entry/course-header.tsx`
- Create: `src/features/interactive/unit-2-4-nyquist-margin-entry/step-panels.tsx`
- Create: `src/features/interactive/unit-2-4-nyquist-margin-entry/workspace.ts`
- Create: `src/app/interactive-learning/courses/unit-2-4-nyquist-margin-entry/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-2-4-nyquist-margin-entry/student/[sessionId]/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-2-4-nyquist-margin-entry/teacher/[sessionId]/page.tsx`

**Step 1: 先复用 2-3 壳层**

- 复制 `2-3` 的入口页、教师页、学生页与顶部导航结构
- 全量替换为 `2-4` 课程常量、AI context、媒体映射和目录文案

**Step 2: 实现 2-4 步骤静态承载与互动工作区**

- 在 `step-panels.tsx` 中按双轨真源实现 17 步静态模块与互动区
- 保证关键公式、图示、边界表、例题链和总结卡在关闭互动时也完整存在
- 仅对契约要求的步骤启用互动输入、AI 区、教师聚合和答案揭示

**Step 3: 运行定向测试**

Run: `npx vitest run src/features/interactive/__tests__/unit-2-4-course.test.ts`

Expected: 页面类型、预览路径和媒体映射全部通过。

### Task 4: 接入课程目录、课堂路由与预置教案

**Files:**
- Modify: `src/features/interactive/learning-catalog.ts`
- Modify: `src/lib/classroom-session-route.ts`
- Create: `src/features/teacher/preset-lessons/presets/unit-2-4-nyquist-margin-entry.ts`
- Modify: `src/features/teacher/preset-lessons/presets/index.ts`
- Modify: `docs/ProjectDescription.md`

**Step 1: 注册入口**

- 将 `2-4` 精品课卡片加入 `FEATURED_LESSONS`
- 为课堂会话标题匹配新增 `2-4` 路由描述
- 加入 `2-4` 预置教案导出与 preset 列表

**Step 2: 运行相关测试**

Run: `npx vitest run src/features/interactive/__tests__/unit-2-4-course.test.ts src/features/interactive/__tests__/learning-catalog.test.ts`

Expected: 目录和路由注册相关断言通过。

### Task 5: 契约校验与完整验证

**Files:**
- Modify: 如测试揭示还需补充的实现文件

**Step 1: 运行实现一致性校验**

Run: `python3 .agents/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --lesson 2-4`

Expected: `2-4` 课程的步骤标题、互动类型、模板/区域、教师洞察、telemetry 与学生演示页预览路径全部通过。

**Step 2: 运行项目验证**

Run:
- `npx vitest run src/features/interactive/__tests__/unit-2-4-course.test.ts src/features/interactive/__tests__/learning-catalog.test.ts`
- `npm run lint`
- `npm run test`
- `npm run build`

Expected: 全部通过；若构建或测试失败，继续修复直到收敛。
