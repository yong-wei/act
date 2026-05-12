# Interactive Course Hub Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让互动课程页的“精品课程”栏目只保留“柔性之海”，并把 `2-2`、`2-3`、`2-4`、`3-1` 的错误 `100 分钟` 时长统一改为 `90 分钟`，随后完成验证、提交并推送。

**Architecture:** 课程页“精品课程”由 `src/features/interactive/learning-catalog.ts` 的 `PREMIUM_LESSONS` 控制；模块卡片时长来自各课 `src/lib/unit-*-course.ts` 的 `UNIT_*_PREMIUM_LESSON_CARD.duration`；教师预置教案时长来自 `src/features/teacher/preset-lessons/presets/*.ts` 的 `totalDuration`。本次改动保持 runtime 课程结构不变，只清理栏目筛选并对齐 90 分钟真源。

**Tech Stack:** Next.js 14, TypeScript, Vitest, ESLint

### Task 1: 写失败测试

**Files:**
- Modify: `src/features/interactive/__tests__/learning-catalog.test.ts`

**Step 1: 为精品课程栏目筛选补断言**

补充 `PREMIUM_LESSONS` 断言，要求仅保留 `cruise-comfort-boppps`。

**Step 2: 为 2-2 / 2-3 / 2-4 / 3-1 时长补断言**

断言模块卡片时长与对应 preset `totalDuration` 均为 `90` 分钟。

**Step 3: 运行测试确认失败**

Run: `npx vitest run src/features/interactive/__tests__/learning-catalog.test.ts src/features/interactive/__tests__/unit-2-1-replacement.test.ts`

Expected: 因精品课程栏目仍包含多门课程、四门课时长仍为 `100` 而失败。

### Task 2: 修改实现

**Files:**
- Modify: `src/features/interactive/learning-catalog.ts`
- Modify: `src/lib/unit-2-2-course.ts`
- Modify: `src/lib/unit-2-3-course.ts`
- Modify: `src/lib/unit-2-4-course.ts`
- Modify: `src/lib/unit-3-1-course.ts`
- Modify: `src/features/teacher/preset-lessons/presets/unit-2-2-time-domain-response.ts`
- Modify: `src/features/teacher/preset-lessons/presets/unit-2-3-frequency-response-bode-intro.ts`
- Modify: `src/features/teacher/preset-lessons/presets/unit-2-4-nyquist-margin-entry.ts`
- Modify: `src/features/teacher/preset-lessons/presets/unit-3-1-pure-pole-stability-and-dynamics.ts`

**Step 1: 收窄精品课程栏目数据源**

让 `PREMIUM_LESSONS` 仅输出 `cruise-comfort-boppps`。

**Step 2: 修正模块卡片时长**

把四门课 `UNIT_*_PREMIUM_LESSON_CARD.duration` 统一改为 `90 分钟`。

**Step 3: 修正 preset 总时长**

把四门课 preset 的 `totalDuration` 从 `100` 改为 `90`。

### Task 3: 验证与记录

**Files:**
- Modify: `docs/ProjectDescription.md`

**Step 1: 运行针对性测试**

Run: `npx vitest run src/features/interactive/__tests__/learning-catalog.test.ts src/features/interactive/__tests__/unit-2-1-replacement.test.ts`

Expected: PASS

**Step 2: 运行仓库验证**

Run:
- `npm run lint`
- `npm run test`
- `npm run build`

Expected: 全部通过。

**Step 3: 更新项目说明**

在 `docs/ProjectDescription.md` 记录本次互动课程目录/时长修正。

**Step 4: 提交并推送**

Run:
- `git status --short`
- `git add <changed files>`
- `git commit -m "fix: clean interactive course hub premium section"`
- `git push`
