# Module2 Confirmation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将模块2从“单元设计细节初稿”升级为可驱动后续讲义、教案、互动课程设计和媒体清单的确认版总体设计文稿。

**Architecture:** 本轮不重写模块2骨架，而是在既有四单元设计基础上完成“确认态收束”。核心做法是补齐模块级课堂主线、统一 AI 动作链、确认版结论与风险边界，并把这些已确认内容同步回写到总蓝图、摘要与决策日志。

**Tech Stack:** Markdown、课程蓝图文档、`course-content/syllabus-refactor/*`

---

### Task 1: 固化本轮范围与确认标准

**Files:**
- Modify: `course-content/syllabus-refactor/unit-design-details/module2.md`
- Modify: `course-content/syllabus-refactor/unit-design-details.md`
- Create: `docs/plans/2026-03-24-module2-confirmation.md`

**Step 1: 写明本轮确认目标**

- 模块2不再停留在“初稿”，而是进入“确认版”。
- 本轮确认内容包括：
  - 模块2四单元的统一课堂主线；
  - 模块2的统一 AI 融入动作链；
  - 模块2对四类后续产物的确认态接口；
  - 模块2到模块3的边界与不越界约束。

**Step 2: 明确本轮不做的内容**

- 不把模块2直接写成讲义正文。
- 不写逐分钟教案。
- 不写页面逐屏文案或前端实现。
- 不提前展开模块3机制解释与模块4设计语言。

**Step 3: 运行结构核对**

Run: `rg -n "初稿|模块2单元设计细节" course-content/syllabus-refactor/unit-design-details/module2.md course-content/syllabus-refactor/unit-design-details.md`

Expected:
- 能定位模块2仍处于“初稿”口径的位置，作为后续回写目标

### Task 2: 将 `module2.md` 升级为确认版

**Files:**
- Modify: `course-content/syllabus-refactor/unit-design-details/module2.md`

**Step 1: 收束模块2标题与导语**

- 去掉“初稿”口径。
- 将文件目标改为“确认版总体设计文稿”。
- 明确本轮已经确认的模块2职责：
  - `2-1` 建模对象；
  - `2-2` 时域对象；
  - `2-3` 频域对象；
  - `2-4` 图形对象。

**Step 2: 补入模块级课堂主线与统一动作链**

- 新增“模块2课堂主线”段，明确四单元的顺序逻辑。
- 新增“模块2统一 AI 动作链”段，固定：
  - 学生先独立判断；
  - AI 做结构化比对与漏项提示；
  - 学生修订；
  - 教师基于误判分布收束。

**Step 3: 给出各单元 AI 介入边界**

- `2-1`：AI 只做对象分解与结构表达检查。
- `2-2`：AI 只做曲线-参数-指标对应检查。
- `2-3`：AI 只做时频解释链整理。
- `2-4`：AI 只做图形读法归纳。
- 全部单元明确禁止 AI 提前给完整答案、替代推导或提前进入判据。

**Step 4: 补入确认版收束结论**

- 模块2的推荐方案；
- 主要风险；
- 不采用的替代方案及原因；
- 与模块3接口的确认语句。

### Task 3: 同步回写上位文档

**Files:**
- Modify: `course-content/syllabus-refactor/main.md`
- Modify: `course-content/syllabus-refactor/decisions.md`
- Modify: `course-content/syllabus-refactor/blueprint.md`
- Modify: `course-content/syllabus-refactor/module-skeletons.md`
- Modify: `course-content/syllabus-refactor/unit-design-details.md`

**Step 1: 更新摘要态文件**

- 在 `main.md` 中写明模块2已经从初稿升级为确认版。
- 在 `unit-design-details.md` 中把模块2标签从“当前初稿”改成“已确认”。

**Step 2: 追加决策日志**

- 新增一条 `2026-03-24` 决策：
  - 模块2从初稿升级为确认版；
  - 明确四对象主线；
  - 明确统一 AI 动作链；
  - 明确不越界到模块3判据与机制层。

**Step 3: 同步蓝图与模块骨架状态**

- 在 `blueprint.md` 中把模块2的确认态结论写成总蓝图级表达。
- 在 `module-skeletons.md` 中把模块2状态从“骨架重排”升级为“单元确认完成”。

### Task 4: 做文档级验证

**Files:**
- Verify only

**Step 1: 运行文本核验**

Run: `rg -n "初稿" course-content/syllabus-refactor/unit-design-details/module2.md course-content/syllabus-refactor/unit-design-details.md`

Expected:
- 不再命中模块2的“初稿”表述

**Step 2: 运行一致性核验**

Run: `rg -n "模块2.*确认|统一 AI 动作链|建模对象；|时域对象；|频域对象；|图形对象；" course-content/syllabus-refactor/main.md course-content/syllabus-refactor/decisions.md course-content/syllabus-refactor/blueprint.md course-content/syllabus-refactor/module-skeletons.md course-content/syllabus-refactor/unit-design-details/module2.md`

Expected:
- 上位文档与模块2设计文稿都能检索到确认态表述

**Step 3: 运行 diff 健康检查**

Run: `git diff --check -- docs/plans/2026-03-24-module2-confirmation.md course-content/syllabus-refactor/main.md course-content/syllabus-refactor/decisions.md course-content/syllabus-refactor/blueprint.md course-content/syllabus-refactor/module-skeletons.md course-content/syllabus-refactor/unit-design-details.md course-content/syllabus-refactor/unit-design-details/module2.md`

Expected:
- 无空白错误、无冲突标记
