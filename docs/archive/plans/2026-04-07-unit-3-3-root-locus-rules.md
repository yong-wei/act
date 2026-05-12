# Unit 3-3 Root Locus Rules Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `3-3` 已审查的双轨设计源与 runtime 产物落实为完整的精品互动课程，实现统一入口页模板、课堂内外埋点、学生/教师双端与 AI 上下文闭环。

**Architecture:** 以 `3-1`、`3-2` 为模块 3 的直接基线，新增 `unit-3-3-root-locus-rules` 课程常量、AI 上下文、入口页、学生页、教师页与步骤面板；入口页继续复用共享 runtime-first 组件，课堂页继续复用统一 session / analytics / teacher aggregation 底座。先写失败测试约束课程注册、媒体解析、契约对齐与入口页模板，再补最小实现直到通过。

**Tech Stack:** Next.js 14、TypeScript、Vitest、Node 契约校验脚本、runtime lesson bundle、premium lesson shared components。

### Task 1: 固化设计对照与执行基线

**Files:**
- Create: `notes/3-3.md`
- Create: `docs/plans/2026-04-07-unit-3-3-root-locus-rules.md`

**Step 1: 写设计稿到实现稿对照表**

- 把 13 步模板、交互类型、教师聚合、AI 边界和统一接线项写入 `notes/3-3.md`

**Step 2: 记录基线与缺口**

- 标明复用基线为 `unit-3-1`、`unit-3-2`
- 标明缺口为课程常量、AI、页面实现、入口页、路由、catalog、preset

**Step 3: 自检笔记完整性**

Run: `rg -n "step-13|统一接线|入口页" notes/3-3.md`
Expected: 命中 `step-13`、`统一接线`、`入口页`

### Task 2: 写失败测试，锁定 3-3 的接线目标

**Files:**
- Create: `src/features/interactive/__tests__/unit-3-3-course.test.ts`

**Step 1: 写 AI、课程步数、媒体映射、契约对齐、catalog、route resolver、入口页模板、runtime media 解析的失败测试**

覆盖至少这些断言：
- `COURSE_AI_CONTEXT_REGISTRY['unit-3-3-root-locus-rules-v1']` 已注册
- `UNIT_3_3_LESSON_STEPS` 为 13 步，首尾为 `step-01`/`step-13`
- `getUNIT_3_3MediaSrc(...)` 指向真实 `3-3-*` 媒体
- `UNIT_3_3_PAGE_CONTRACTS` 与作者态契约代表步骤严格一致
- `FEATURED_LESSONS` 与 `resolveSessionRouteFromPlanTitle(...)` 已纳入 `3-3`
- 入口页源码包含 `LessonEntryMediaHub`、`LessonEntryRuntimeSections`
- `3-3-media.md` 能解析出四类资源且 `handout.md` 不落入 `mediaResources`

**Step 2: 运行单测确认失败**

Run: `npm run test -- src/features/interactive/__tests__/unit-3-3-course.test.ts`
Expected: FAIL，原因是 `unit-3-3` 尚未实现或未注册

### Task 3: 实现 3-3 课程常量、AI 上下文与最小契约骨架

**Files:**
- Create: `src/lib/unit-3-3-course.ts`
- Create: `src/lib/unit-3-3-ai-contexts.ts`
- Modify: `src/lib/course-ai-contexts.ts`
- Modify: `src/lib/classroom-session-route.ts`

**Step 1: 建立课程元数据与页面契约**

- 在 `src/lib/unit-3-3-course.ts` 中新增：
  - route / preset / resource key / title / subtitle / description
  - `UNIT_3_3_PAGE_CONTRACTS`
  - `UNIT_3_3_LESSON_STEPS`
  - `getUNIT_3_3MediaSrc`
  - `UNIT_3_3_PREMIUM_LESSON_CARD`
  - 学生 / 教师状态类型与适配器导出

**Step 2: 建立步骤级 AI 配置**

- 在 `src/lib/unit-3-3-ai-contexts.ts` 中按 13 步落 `topic`、`learningObjectives`、`quickQuestions`、`systemPromptExtension`

**Step 3: 注册课程级 AI 与课堂码路由**

- 在 `src/lib/course-ai-contexts.ts` 注册 `unit-3-3-root-locus-rules-v1`
- 在 `src/lib/classroom-session-route.ts` 添加 `3-3` 标题别名与 route segment

**Step 4: 运行单测**

Run: `npm run test -- src/features/interactive/__tests__/unit-3-3-course.test.ts`
Expected: 仍可能 FAIL，但应收敛到页面文件或目录注册缺失

### Task 4: 实现入口页、步骤面板、学生页、教师页与路由

**Files:**
- Create: `src/features/interactive/unit-3-3-root-locus-rules/entry-page.tsx`
- Create: `src/features/interactive/unit-3-3-root-locus-rules/course-header.tsx`
- Create: `src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx`
- Create: `src/features/interactive/unit-3-3-root-locus-rules/workspace.ts`
- Create: `src/features/interactive/unit-3-3-root-locus-rules/student-page.tsx`
- Create: `src/features/interactive/unit-3-3-root-locus-rules/teacher-page.tsx`
- Create: `src/app/interactive-learning/courses/unit-3-3-root-locus-rules/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-3-3-root-locus-rules/student/[sessionId]/page.tsx`
- Create: `src/app/interactive-learning/courses/unit-3-3-root-locus-rules/teacher/[sessionId]/page.tsx`

**Step 1: 入口页复用统一模板**

- 以 `unit-3-1` / `unit-3-2` 入口页为基线
- 接入 `LessonEntryMediaHub`、`LessonEntryRuntimeSections`
- `courseLabel` 固定为 `3-3 · Pre-study`

**Step 2: 实现步骤内容与活动规格**

- 在 `step-panels.tsx` 中落 13 步的：
  - 静态内容蓝图
  - 活动规格
  - reveal 内容
  - 学生作答表单
  - 教师聚合摘要
- 在 `workspace.ts` 中集中声明 `region_highlight`、`worked_example_workspace`、`formula_ordering`、`mapping_highlight` 等本课专用数据结构

**Step 3: 实现学生页与教师页**

- 复用统一 session / SSE / analytics / AI context 更新链
- 学生页支持 demo 预览、释放态、提交态、揭示态、AI 抽屉
- 教师页支持放行活动、揭示答案、查看汇总、结束课堂

**Step 4: 路由接入**

- 新增 entry / student / teacher App Router 页面

**Step 5: 运行单测**

Run: `npm run test -- src/features/interactive/__tests__/unit-3-3-course.test.ts`
Expected: 大部分断言转绿

### Task 5: 注册目录、预置教案与最终契约校验

**Files:**
- Create: `src/features/teacher/preset-lessons/presets/unit-3-3-root-locus-rules.ts`
- Modify: `src/features/teacher/preset-lessons/presets/index.ts`
- Modify: `src/features/interactive/learning-catalog.ts`

**Step 1: 注册预置教案**

- 新增 `UNIT_3_3_ROOT_LOCUS_RULES_PRESET`
- 按步骤映射 BOPPPS stage、registryId、时长与标题

**Step 2: 注册课程目录**

- 加入 `FEATURED_LESSONS`
- 加入 `PREMIUM_LESSONS`
- 加入 `module-3` lessons 列表

**Step 3: 运行单测确认通过**

Run: `npm run test -- src/features/interactive/__tests__/unit-3-3-course.test.ts`
Expected: PASS

### Task 6: 运行契约与实现闭环校验

**Files:**
- Modify: `notes/3-3.md`

**Step 1: 跑作者态审查与实现契约校验**

Run: `python3 course-content/scripts/review_lesson_content.py --lesson 3-3 --strict-implementation-contract`
Expected: PASS

**Step 2: 跑实现侧契约对齐脚本**

Run: `python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --contract course-content/authoring/lessons/3-3/design/interactive-contract.yaml --implementation src/lib/unit-3-3-course.ts --page-contract-const UNIT_3_3_PAGE_CONTRACTS --step-const UNIT_3_3_LESSON_STEPS`
Expected: PASS

**Step 3: 跑本地 lint / targeted test**

Run: `npm run lint`
Expected: PASS

**Step 4: 更新笔记验证记录**

- 在 `notes/3-3.md` 补齐：
  - 完整课件职责核对结论
  - 契约校验证据
  - 仍待回补项
