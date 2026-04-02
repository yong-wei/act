# Lesson 3-8 Resource Library Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** 以新增资源库为正式输入源，重构 `3-8（理论） 频域判别与跨域综合语言` 的内容组织、资源融入边界与后续产物接口。

**Architecture:** 以 `course-content/syllabus-refactor/unit-design-details/module3.md` 为主修改面，补齐 `3-8` 的课堂组织主线、资源融入评审单、固定产出与对讲义/教案/互动课程设计/媒体清单的约束；再同步 `main.md` 与 `decisions.md`，确保课程级摘要和决策记录一致。

**Tech Stack:** Markdown、课程大纲重构文档、资源库索引与提取文档

### Task 1: 锁定 3-8 的资源融入边界

**Files:**
- Modify: `course-content/syllabus-refactor/unit-design-details/module3.md`
- Reference: `course-content/resource-library/integration-framework.md`
- Reference: `course-content/resource-library/indexes/syllabus-fusion-map.md`
- Reference: `course-content/resource-library/pptx/16频率特性_换个角度看控制/extracted.md`
- Reference: `course-content/resource-library/pptx/19稳定判据_频域的启示/extracted.md`
- Reference: `course-content/resource-library/pptx/21三频段_各司其职/extracted.md`
- Reference: `course-content/resource-library/civics-cases/cases/04-根轨全局观拓荒.md`
- Reference: `course-content/resource-library/civics-cases/cases/06-频段强国策应器.md`
- Reference: `course-content/resource-library/ship-control-cases/sections/5.1-船舶航向控制频域分析.md`
- Reference: `course-content/resource-library/ship-control-cases/sections/5.3-船载稳定平台控制系统频域分析.md`

**Step 1: 明确本课主轴**

将 `3-8` 重新组织为“先翻译结构变化，再收束判稳，再连接闭环性能”的三段链，而不是按判据罗列。

**Step 2: 形成资源融入评审单**

写出 `pptx / civics / ship-case` 的候选资源、落点、采用方式、采用级别和排除理由。

**Step 3: 固定本课固定产出与四类产物接口**

补齐讲义、教案、互动课程设计、媒体清单的本课级约束。

### Task 2: 同步课程级摘要与决策记录

**Files:**
- Modify: `course-content/syllabus-refactor/main.md`
- Modify: `course-content/syllabus-refactor/decisions.md`

**Step 1: 更新最近确认摘要**

把 `3-8` 的新组织原则、资源锚点与后续产物约束写入 `main.md`。

**Step 2: 更新决策记录**

在 `decisions.md` 中把 `3-8` 的定位、必须覆盖范围与“翻译优先”的组织原则补成更具体的资源化口径。

### Task 3: 校对一致性

**Files:**
- Review: `course-content/syllabus-refactor/unit-design-details/module3.md`
- Review: `course-content/syllabus-refactor/main.md`
- Review: `course-content/syllabus-refactor/decisions.md`

**Step 1: 检查术语与边界**

确认 `3-8` 没有侵入模块2的绘图基础，也没有提前滑入模块4的选型/整定/优化。

**Step 2: 检查资源口径**

确认资源使用遵循“转译关系”而不是“替代关系”，并明确不强行接入不合适资源。
