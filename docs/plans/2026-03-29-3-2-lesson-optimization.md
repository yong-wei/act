# 3-2 Lesson Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不打乱模块3主线的前提下，从全局视角重构 `3-2` 的定位、边界和资源吸收方案，使其成为 `3-1` 到 `3-3` 的稳定边界桥接实践课。

**Architecture:** 先核对课程总蓝图、模块3边界、作业边界和资源库映射，再把 `3-2` 的主线收束为“判据结论 -> 边界 -> 越轴 -> 响应突变”。只回写真值层文档，不提前扩展到完整 authoring/runtime 成稿。

**Tech Stack:** Markdown, `rg`, `git diff`, `apply_patch`

### Task 1: 收敛 3-2 的全局边界

**Files:**
- Modify: `course-content/syllabus-refactor/decisions.md`
- Modify: `course-content/syllabus-refactor/main.md`
- Modify: `course-content/syllabus-refactor/blueprint.md`
- Modify: `course-content/syllabus-refactor/unit-design-details/module3.md`

**Step 1: 读取真值层与资源索引**

Run: `rg -n '3-2|T3-1|T3-2' course-content/syllabus-refactor course-content/resource-library`
Expected: 能同时看到 `3-2` 的骨架、作业边界和资源映射位置

**Step 2: 写出 3-2 的推荐主线**

Write:
- `3-2` 是桥接实践，不是独立劳斯技巧课
- 统一对象、单参数、纯极点
- 主线固定为“判据结论 -> 虚轴边界 -> 极点越轴 -> 响应突变”

**Step 3: 写出资源采用与排除结论**

Write:
- `pptx/8` 必融入
- `T3-1` 与结构化题库只做强度校准
- `civics 03`、船舶根轨迹案例、根轨迹 `pptx` 包排除
- 特殊情况与区域平移技巧降位或排除

**Step 4: 回写真值层文件**

Run: `git diff -- course-content/syllabus-refactor/decisions.md course-content/syllabus-refactor/main.md course-content/syllabus-refactor/blueprint.md course-content/syllabus-refactor/unit-design-details/module3.md`
Expected: 只出现 `3-2` 相关的边界、资源和接口增强

### Task 2: 生成可追溯的执行计划文档

**Files:**
- Create: `docs/plans/2026-03-29-3-2-lesson-optimization.md`

**Step 1: 记录目标与影响范围**

Write:
- 为什么要优化 `3-2`
- 本轮只处理真值层，不处理成稿层

**Step 2: 记录验证方式**

Write:
- 用 `rg` 检查 `3-2` 在几份真值文件中的表述是否一致
- 用 `git diff` 检查改动范围是否收敛

### Task 3: 一致性核对

**Files:**
- Verify: `course-content/syllabus-refactor/decisions.md`
- Verify: `course-content/syllabus-refactor/main.md`
- Verify: `course-content/syllabus-refactor/blueprint.md`
- Verify: `course-content/syllabus-refactor/unit-design-details/module3.md`

**Step 1: 核对 3-2 的定位是否一致**

Run: `rg -n '3-2' course-content/syllabus-refactor/decisions.md course-content/syllabus-refactor/main.md course-content/syllabus-refactor/blueprint.md course-content/syllabus-refactor/unit-design-details/module3.md`
Expected: 各文件都体现“桥接实践、单参数、边界可视化、不过早进入根轨迹法则”

**Step 2: 核对资源采用是否一致**

Run: `rg -n 'pptx/8|AC-Q-0047|AC-Q-0046|civics|ship-control-cases/sections/4.1-4.3|根轨迹法' course-content/syllabus-refactor/decisions.md course-content/syllabus-refactor/unit-design-details/module3.md`
Expected: `pptx/8` 为主资源，其他资源采用/排除关系与 3-2 边界一致
