# 3-3 Interactive Lesson Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `3-3` 互动课程从当前 13 步旧实现整改为与作者态双轨真源一致的 17 步版本。

**Architecture:** 以 `course-content/authoring/lessons/3-3/design/interactive-contract.yaml` 为机读真源，以 `interactive-page.md` 为人读真源，先修正课程常量与测试，再补 `step-panels.tsx` 的新步骤与新互动类型，最后更新 AI 上下文与对照表。尽量复用现有 3-3 页面壳与表单/汇总框架，只扩展缺失的互动类型与 4 个新增步骤。

**Tech Stack:** Next.js 14, TypeScript, React, Vitest, Python 3 review/alignment scripts

### Task 1: 固化 17 步真源断言

**Files:**
- Modify: `src/features/interactive/__tests__/unit-3-3-course.test.ts`

**Step 1: Write the failing test**

- 把“13-step lesson flow”改为 17 步断言。
- 断言最后一步是 `step-17`。
- 把契约代表步骤扩展到 `step-05`、`step-10`、`step-11`、`step-12`、`step-16`、`step-17`。
- 增加对新互动类型 `activity_cards`、`sequence_sort`、`classification_cards` 的对齐断言。

**Step 2: Run test to verify it fails**

Run: `rtk npx vitest run src/features/interactive/__tests__/unit-3-3-course.test.ts`

Expected: 失败，原因是当前课程常量仍只有 13 步，且本地契约与作者态 17 步不一致。

### Task 2: 补齐 3-3 课程常量与 AI 上下文

**Files:**
- Modify: `src/lib/unit-3-3-course.ts`
- Modify: `src/lib/unit-3-3-ai-contexts.ts`

**Step 1: Write minimal implementation**

- 把 `UNIT_3_3PageType` 扩展到 `activity_cards`、`sequence_sort`、`classification_cards`。
- 按作者态契约重写 `UNIT_3_3_PAGE_CONTRACTS` 与 `UNIT_3_3_LESSON_STEPS` 为 `step-01` 到 `step-17`。
- 更新媒体映射到新增步骤。
- 补齐 `step-14` 到 `step-17` 以及改名后的 `step-05` 到 `step-13` AI 上下文。

**Step 2: Run tests**

Run: `rtk npx vitest run src/features/interactive/__tests__/unit-3-3-course.test.ts`

Expected: 仍可能失败，但失败点应转移到 `step-panels.tsx` 文案或互动类型支持缺失。

### Task 3: 补齐 17 步页面内容与新互动类型

**Files:**
- Modify: `src/features/interactive/unit-3-3-root-locus-rules/step-panels.tsx`
- Modify: `src/features/interactive/unit-3-3-root-locus-rules/workspace.ts`

**Step 1: Write minimal implementation**

- 把页面蓝图改成 17 步顺序与标题。
- 新增 `step-10`、`step-11`、`step-12`、`step-17` 页面内容，并重排原 `step-05` 到 `step-09`。
- 增加 `activity_cards`、`sequence_sort`、`classification_cards` 三种表单、教师参考锚点、汇总统计与参考答案。
- 保留现有 `binary_choice`、`short_response`、`reason_check`、`region_highlight`、`triple_match`、`worked_example_workspace`、`formula_ordering`、`tab_switch`、`mapping_highlight`、`quiz_group` 的通用壳。

**Step 2: Run tests**

Run: `rtk npx vitest run src/features/interactive/__tests__/unit-3-3-course.test.ts`

Expected: 测试通过。

### Task 4: 更新对照表与验证

**Files:**
- Modify: `notes/3-3.md`

**Step 1: Update docs**

- 把当前状态从“13 步已完成”改成 17 步对齐结果。
- 记录实际跑过的测试与审查命令。

**Step 2: Run verification**

Run:
- `rtk npx vitest run src/features/interactive/__tests__/unit-3-3-course.test.ts`
- `rtk python3 .codex/skills/interactive-lesson-implementation/scripts/check_contract_alignment.py --contract course-content/authoring/lessons/3-3/design/interactive-contract.yaml --implementation src/lib/unit-3-3-course.ts --page-contract-const UNIT_3_3_PAGE_CONTRACTS --step-const UNIT_3_3_LESSON_STEPS`
- `rtk npm run lint`

Expected: 全部通过；若时间允许，再补 `rtk npm run build`。
