# 3-7 Interactive Rectification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 `3-7` 互动课程重新对齐作者态双轨设计，重点修正显式页内 AI、步骤级阅读顺序和关键静态证据缺失。

**Architecture:** 保留现有 `unit-3-7` 课程注册、会话同步和课堂事件链，只在 `unit-3-7-course.ts`、课堂页面和 `step-panels.tsx` 内做最小骨架调整。先补回归测试，再把页面布局改为按步骤控制顺序，并扩展静态证据文本。

**Tech Stack:** Next.js 14、TypeScript、React、Vitest、现有 premium lesson 组件体系。

### Task 1: 建立整改约束

**Files:**
- Create: `notes/3-7.md`
- Create: `docs/plans/2026-04-15-3-7-interactive-rectification-design.md`
- Test: `src/features/interactive/__tests__/unit-3-7-course.test.ts`

**Step 1: 写失败测试**
- 为 `isUNIT_3_7AiPageType`、`isUNIT_3_7ActivityFirstStep` 和关键静态证据文本补断言。

**Step 2: 运行测试确认失败**
- Run: `npm run test -- src/features/interactive/__tests__/unit-3-7-course.test.ts`
- Expected: 断言失败，暴露当前显式页内 AI、顺序与内容缺口。

### Task 2: 调整课程骨架

**Files:**
- Modify: `src/lib/unit-3-7-course.ts`
- Modify: `src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/student-page.tsx`
- Modify: `src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/teacher-page.tsx`

**Step 1: 最小实现**
- 新增 `isUNIT_3_7ActivityFirstStep(stepId)`。
- 让 `isUNIT_3_7AiPageType` 返回 `false`。
- 学生页与教师页按步骤切换 `activity-first` / `content-first` 顺序。

**Step 2: 验证**
- Run: `npm run test -- src/features/interactive/__tests__/unit-3-7-course.test.ts`

### Task 3: 补齐静态证据面板

**Files:**
- Modify: `src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/step-panels.tsx`
- Test: `src/features/interactive/__tests__/unit-3-7-course.test.ts`

**Step 1: 最小实现**
- 移除显式页内 AI 组件与相关依赖。
- 扩展 `STEP_BLUEPRINTS`，补齐 `step-04`、`step-05`、`step-06`、`step-07`、`step-09`、`step-11`、`step-12` 的静态证据文本。
- 修正 `step-10`、`step-11` 的重复插图。

**Step 2: 验证**
- Run: `npm run test -- src/features/interactive/__tests__/unit-3-7-course.test.ts`

### Task 4: 收尾验证

**Files:**
- Modify: `docs/ProjectDescription.md`（仅当本轮改动影响项目说明时）

**Step 1: 运行验证**
- Run: `npm run test -- src/features/interactive/__tests__/unit-3-7-course.test.ts`
- Run: `npm run lint -- --file src/lib/unit-3-7-course.ts --file src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/student-page.tsx --file src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/teacher-page.tsx --file src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/step-panels.tsx`

**Step 2: 视结果决定是否扩展到 `npm run test` / `npm run build`**
- 若局部验证通过且无编译风险，再执行更大范围验证。
