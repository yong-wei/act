# Unit 3-7 Interactive Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `3-7` 互动课程从旧版 `12` 步课堂实现重构为与双轨真源一致的新版 `17` 步精品互动课。

**Architecture:** 以 `course-content/authoring/lessons/3-7/design/interactive-page.md` 与 `interactive-contract.yaml` 为真源，先用测试把课程契约、AI 上下文和页面映射固定成 17 步，再重构 `unit-3-7-course.ts`、`unit-3-7-ai-contexts.ts` 与 `step-panels.tsx`。课堂骨架、入口页与教师/学生会话同步机制继续复用现有实现，不另起新框架。

**Tech Stack:** Next.js 14、TypeScript、Vitest、现有精品互动课课堂会话框架

### Task 1: 固化新版 17 步测试约束

**Files:**
- Modify: `src/features/interactive/__tests__/unit-3-7-course.test.ts`
- Reference: `course-content/authoring/lessons/3-7/design/interactive-contract.yaml`

**Step 1: Write the failing test**

- 把 “full 12-step lesson flow” 改成新版 `17` 步断言。
- 代表性契约对齐步骤改为覆盖 `step-03`、`step-04`、`step-05`、`step-06`、`step-09`、`step-10`、`step-11`、`step-12`、`step-13`、`step-14`、`step-15`、`step-16`、`step-17`。
- 用正确的 YAML 解析方式读取 `interactive-contract.yaml`。

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/interactive/__tests__/unit-3-7-course.test.ts`
Expected: 失败，原因是课程仍导出 12 步，且步骤契约与测试断言不一致。

### Task 2: 重构课程契约与媒体/页面映射

**Files:**
- Modify: `src/lib/unit-3-7-course.ts`

**Step 1: Write the failing test**

- 依赖 Task 1 的失败测试，不再新增第二份重复测试。

**Step 2: Write minimal implementation**

- 把 `UNIT_3_7_PAGE_CONTRACTS` 改成 17 步。
- 把 `UNIT_3_7_LESSON_STEPS` 改成 17 步标题、阶段与页面类型。
- 更新 `isUNIT_3_7ActivityFirstStep`、媒体映射与相关工具函数。

**Step 3: Run test to verify partial progress**

Run: `npm run test -- src/features/interactive/__tests__/unit-3-7-course.test.ts`
Expected: 仍失败，但失败点前移到 AI 上下文或页面内容映射。

### Task 3: 重构步骤级 AI 上下文

**Files:**
- Modify: `src/lib/unit-3-7-ai-contexts.ts`

**Step 1: Write minimal implementation**

- 为 `step-01 ~ step-17` 补齐或更新 `topic`、`learningObjectives`、`quickQuestions` 与 `systemPromptExtension`。
- 确保方法页、比较页、后测页与收束页各自拥有独立上下文，不再复用旧版综合页语义。

**Step 2: Run test to verify partial progress**

Run: `npm run test -- src/features/interactive/__tests__/unit-3-7-course.test.ts`
Expected: 失败进一步收敛到 `step-panels.tsx` 的内容与媒体断言。

### Task 4: 重构页面内容与交互映射

**Files:**
- Modify: `src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/step-panels.tsx`
- Modify: `src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/workspace.ts`

**Step 1: Write minimal implementation**

- 把 `STEP_BLUEPRINTS` 扩展到 17 步，并按设计稿恢复方法页、比较页、后测页与收束页拆分。
- 更新学生作答区逻辑，使 `step-10 ~ step-15` 的方法页和比较页使用正确题卡集合。
- 更新字段集合，删除旧版仅适用于 12 步结构的命名。

**Step 2: Run test to verify it passes**

Run: `npm run test -- src/features/interactive/__tests__/unit-3-7-course.test.ts`
Expected: 通过。

### Task 5: 最终校验与收尾

**Files:**
- Verify only: `src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/student-page.tsx`
- Verify only: `src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/teacher-page.tsx`

**Step 1: Run focused verification**

Run: `npm run test -- src/features/interactive/__tests__/unit-3-7-course.test.ts`
Expected: PASS

**Step 2: Run broader verification if touched behavior requires it**

Run: `npm run lint`
Expected: PASS 或只暴露与本轮修改直接相关的问题并继续修正。

**Step 3: Commit**

```bash
git add notes/3-7.md docs/plans/2026-04-16-unit-3-7-interactive-refactor.md src/lib/unit-3-7-course.ts src/lib/unit-3-7-ai-contexts.ts src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/step-panels.tsx src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/workspace.ts src/features/interactive/__tests__/unit-3-7-course.test.ts
git commit -m "interactive: refactor unit 3-7 to 17-step flow"
```
