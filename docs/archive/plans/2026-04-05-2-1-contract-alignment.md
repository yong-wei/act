# 2-1 Contract Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `2-1` 的本地互动页面实现重新对齐到作者态 `interactive-contract.yaml`，并把“作者态契约 vs 本地实现”自动一致性校验接入 `course-content/scripts/review_lesson_content.py` 审查链路。

**Architecture:** 先用前端单测和课程内容审查单测把当前漂移固定成红灯，再同步修改 `src/lib/unit-2-1-course.ts` 与 `src/features/interactive/unit-2-1-modeling-language/step-panels.tsx`，最后在 `review_lesson_content.py` 中新增实现契约一致性检查，并将其结果写入 `interactive-page-check.json`，支持严格模式失败退出。

**Tech Stack:** TypeScript/Vitest、Python3/pytest、Node/TypeScript AST、Next.js 互动课程框架。

### Task 1: 写失败测试锁定 2-1 契约漂移

**Files:**
- Modify: `src/features/interactive/__tests__/unit-2-1-course.test.ts`

**Step 1: Write the failing test**

- 增加测试，逐项校验 `step-05/06/07/09/15/16` 的本地页面契约与作者态 `interactive-contract.yaml` 在模板、区域、教师洞察、埋点、错因标签上的一致性。

**Step 2: Run test to verify it fails**

- Run: `npm test -- --run src/features/interactive/__tests__/unit-2-1-course.test.ts`

**Step 3: Write minimal implementation**

- 暂不实现，只确认失败点命中真实漂移。

### Task 2: 写失败测试锁定审查脚本缺口

**Files:**
- Modify: `course-content/tests/test_review_lesson_content.py`

**Step 1: Write the failing test**

- 增加测试，要求 `build_interactive_page_check()` 输出实现契约一致性结果，并能在 2-1 对齐后返回无漂移。
- 增加一个最小临时课次测试，确认脚本能报告本地实现契约漂移。

**Step 2: Run test to verify it fails**

- Run: `python3 -m pytest course-content/tests/test_review_lesson_content.py -q`

### Task 3: 对齐 2-1 本地页面契约与渲染区域

**Files:**
- Modify: `src/lib/unit-2-1-course.ts`
- Modify: `src/features/interactive/unit-2-1-modeling-language/step-panels.tsx`

**Step 1: Write minimal implementation**

- 把 `step-05/06/07/09/15/16` 的本地 `PAGE_CONTRACTS` 字段改回作者态契约。
- 为新区域 ID 补齐渲染分支，确保页面不因区域更名而丢内容。

**Step 2: Run test to verify it passes**

- Run: `npm test -- --run src/features/interactive/__tests__/unit-2-1-course.test.ts`

### Task 4: 接入审查脚本的一致性校验

**Files:**
- Modify: `course-content/scripts/review_lesson_content.py`
- Modify: `course-content/tests/test_review_lesson_content.py`
- Modify: `.agents/skills/interactive-lesson-implementation/SKILL.md`
- Modify: `scripts/tests/test-interactive-lesson-skill.ts` or `scripts/tests/test-interactive-lesson-skill-rules.mjs`

**Step 1: Write minimal implementation**

- 在 `review_lesson_content.py` 中新增“作者态契约 vs 本地实现”一致性检查。
- 把结果并入 `interactive-page-check.json`。
- 增加严格模式参数，供技能在实现完成后执行并要求通过。
- 更新技能文档和对应技能测试，固化该命令要求。

**Step 2: Run tests to verify they pass**

- Run: `python3 -m pytest course-content/tests/test_review_lesson_content.py -q`
- Run: `npm test -- --run scripts/tests/test-interactive-lesson-skill.ts`

### Task 5: 完整验证

**Files:**
- Modify: `course-content/authoring/lessons/2-1/notes/interactive-implementation.md`
- Modify: `docs/ProjectDescription.md`

**Step 1: Verify review script passes in strict mode**

- Run: `python3 course-content/scripts/review_lesson_content.py --lesson 2-1 --strict-implementation-contract`

**Step 2: Verify broader repo health**

- Run: `npm run lint`
- Run: `npm run test`
- Run: `npm run build`

**Step 3: Record evidence**

- 把命令和结果补回 `notes/interactive-implementation.md` 与 `docs/ProjectDescription.md`。
