# Unit 3-7 Outline Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不改动模块3总骨架的前提下，基于新增资源库正式输入规则，增强 `3-7`《型别、积分环节与稳态改善》单元的内容组织、资源融入口径与后续产物约束。

**Architecture:** 以 `course-content/syllabus-refactor/` 现有蓝图为主版本，先复核 `3-7` 当前定位与资源库映射，再把资源评审单、课堂组织主线、关键对照关系和产物级约束写回单元细化文档，并同步记录决策与项目状态。保持模块3既有“动态改善线 vs 稳态改善线”分工不变，只增强 `3-7` 的可执行边界。

**Tech Stack:** Markdown, syllabus-refactor 文档体系, resource-library 索引体系

### Task 1: 固化本轮改动边界

**Files:**
- Modify: `course-content/syllabus-refactor/unit-design-details/module3.md`
- Modify: `course-content/syllabus-refactor/decisions.md`
- Modify: `course-content/syllabus-refactor/main.md`
- Modify: `docs/ProjectDescription.md`

**Step 1: 复核 `3-7` 当前边界与资源候选**

Run: `rg -n "3-7|稳态误差|PI|滞后|型别" course-content/syllabus-refactor/unit-design-details/module3.md course-content/resource-library/indexes/syllabus-fusion-map.md`

Expected: 能定位到 `3-7` 的现有定位、知识清单和资源映射入口。

**Step 2: 增强 `3-7` 单元细化文档**

Write:
- 新的课堂组织主线；
- 必须压实的关键对照关系；
- 资源融入评审单；
- 对讲义、教案、互动课程设计、媒体清单的约束。

Expected: `module3.md` 中 `3-7` 不再只停留在“知识点罗列”，而具备后续作者态可直接继承的边界。

**Step 3: 同步决策与摘要**

Write:
- 在 `decisions.md` 中新增本轮 `3-7` 增强决策；
- 在 `main.md` 中补充 `3-7` 的最新确认口径；
- 在 `docs/ProjectDescription.md` 中记录本轮更新摘要。

Expected: 课程重构主文档与项目说明对本轮变更有一致记录。

**Step 4: 复核差异**

Run: `git diff -- course-content/syllabus-refactor/unit-design-details/module3.md course-content/syllabus-refactor/decisions.md course-content/syllabus-refactor/main.md docs/ProjectDescription.md docs/plans/2026-04-01-unit-3-7-outline-enhancement.md`

Expected: 只出现 `3-7` 相关增强与计划文件新增，没有误伤其他单元。
