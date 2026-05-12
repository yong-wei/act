# Module1 Confirmation And Global Review Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 敲定模块1骨架，并在模块1至模块5的当前确认状态上完成一轮课程全局审查。

**Architecture:** 本轮先补齐模块1在 `unit-design-details/` 层的缺口，把它从“骨架重排”升级为“单元确认”；然后基于模块1到模块5的最新状态，输出一份全局审查结论，重点检查能力链、内容链、课时链、AI 动作链和四类产物接口是否闭环。

**Tech Stack:** Markdown、课程蓝图文档、`course-content/syllabus-refactor/*`

---

### Task 1: 固化模块1确认目标

**Files:**
- Create: `docs/plans/2026-03-24-module1-and-global-review.md`
- Modify: `course-content/syllabus-refactor/unit-design-details.md`

**Step 1: 明确模块1本轮目标**

- 不把模块1写成完整讲义。
- 只把模块1从“骨架重排”升级为“确认版总体设计文稿”。
- 明确它对模块2的输出和对四类产物的接口。

### Task 2: 新建 `module1.md`

**Files:**
- Create: `course-content/syllabus-refactor/unit-design-details/module1.md`

**Step 1: 写模块级定位与四类产物接口**

- 模块1负责建立课程地图，而不是深挖方法。
- 写清讲义、教案、互动课程设计、媒体清单的模块级接口。

**Step 2: 固化 5 个单元的边界表**

- `1-1` 基本概念、课程规范与总图发布
- `1-2` 模型与复平面极点的第一轮速通
- `1-3` 根轨迹与时域响应的第一轮速通
- `1-4` 时域响应与频域响应的第一轮速通
- `1-5` 平台初体验与三域联动探索

**Step 3: 补模块1课堂主线与统一 AI 动作链**

- AI 只做框架梳理、概念映射和误判纠偏。
- 不代替学生完成后续模块应承担的分析推导。

### Task 3: 同步回写上位文档

**Files:**
- Modify: `course-content/syllabus-refactor/main.md`
- Modify: `course-content/syllabus-refactor/decisions.md`
- Modify: `course-content/syllabus-refactor/module-skeletons.md`
- Modify: `course-content/syllabus-refactor/unit-design-details.md`

**Step 1: 更新状态**

- `module-skeletons.md` 中模块1改为已完成单元确认。
- `unit-design-details.md` 新增模块1入口。

**Step 2: 追加确认结论**

- `main.md` 中写入模块1当前确认骨架与进一步确认结论。
- `decisions.md` 中追加模块1确认决策。

### Task 4: 执行课程全局审查

**Files:**
- Create: `docs/plans/2026-03-24-course-global-review.md`

**Step 1: 形成审查维度**

- 能力链是否连续
- 内容链是否重叠或断裂
- 课时链是否闭合
- AI 动作链是否失控
- 四类产物接口是否基本齐备

**Step 2: 输出全局审查结论**

- 给出已闭环部分
- 给出主要风险
- 给出下一步优先顺序

### Task 5: 做文档级验证

**Files:**
- Verify only

**Step 1: 检查模块1入口与状态**

Run: `rg -n "模块1单元设计细节|已完成单元确认|模块1当前确认骨架" course-content/syllabus-refactor/unit-design-details.md course-content/syllabus-refactor/module-skeletons.md course-content/syllabus-refactor/main.md course-content/syllabus-refactor/unit-design-details/module1.md`

**Step 2: 检查全局审查文档**

Run: `rg -n "全局审查|能力链|内容链|课时链|AI 动作链|四类产物接口|主要风险|下一步优先顺序" docs/plans/2026-03-24-course-global-review.md`

**Step 3: 检查格式**

Run: `git diff --check -- docs/plans/2026-03-24-module1-and-global-review.md docs/plans/2026-03-24-course-global-review.md course-content/syllabus-refactor/main.md course-content/syllabus-refactor/decisions.md course-content/syllabus-refactor/module-skeletons.md course-content/syllabus-refactor/unit-design-details.md course-content/syllabus-refactor/unit-design-details/module1.md`
