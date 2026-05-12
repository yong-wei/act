# 模块1单元讲义撰写计划

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task.

**Goal:** 完成模块1五个单元 `1-1` 至 `1-5` 的学生版讲义 `handout.md`，形成作者态可继续扩展的模块1主线。

**Architecture:** 先由主代理汇总模块1统一边界、legacy 来源与资源采用约束，再将五个单元拆成互不重叠的写作任务并行分发给子代理。每个子代理只写一个单元目录下的 `design/handout.md`，主代理负责统一口吻、核对结构完整性并在必要时补做草稿 PDF 导出。

**Tech Stack:** Markdown；项目 lesson 技能约束；legacy 讲义与资源库转译；Codex 子代理。

### Task 1: 单元 `1-1` 讲义

**Files:**
- Create: `course-content/authoring/lessons/1-1/design/handout.md`

**Requirements:**
- 主题为“基本概念建立、课程规范与学习规则、课程总图发布”。
- 主要资源来自 `course-content/resource-library/pptx/1反馈_控制原理的核心思想/README.md` 与 `course-content/resource-library/civics-cases/cases/01-华夏自控启明星.md`。
- 必须守住模块1“总图建立”边界，不提前进入模块2/3/4 的正式方法。
- 文风遵循 `lesson` 的 handout 规则：`clean brief -> prose -> 去污染`，采用书面化“我们”视角。

### Task 2: 单元 `1-2` 讲义

**Files:**
- Create: `course-content/authoring/lessons/1-2/design/handout.md`

**Requirements:**
- 主题为“模型与复平面极点的第一轮速通”。
- 可吸收 `course-content/authoring/lessons/legacy/L-2a/design/handout.md` 的文风与核心对象，但不能照搬结构与措辞。
- 必须保留“模型—极点—系统行为”的直观链路，不进入模块2的正式建模推导。

### Task 3: 单元 `1-3` 讲义

**Files:**
- Create: `course-content/authoring/lessons/1-3/design/handout.md`

**Requirements:**
- 主题为“根轨迹与时域响应的第一轮速通”。
- 可吸收 `course-content/authoring/lessons/legacy/L-2b/design/handout.md` 的核心对象。
- 只建立参数变化、极点迁移、根轨迹雏形与时域现象的联系，不进入正式绘制法则与计算。

### Task 4: 单元 `1-4` 讲义

**Files:**
- Create: `course-content/authoring/lessons/1-4/design/handout.md`

**Requirements:**
- 主题为“时域响应与频域响应的第一轮速通”。
- 可吸收 `course-content/authoring/lessons/legacy/L-2c/design/handout.md` 的核心对象。
- 只建立时域、频域与三域并置直觉，不提前系统展开 `G(j\omega)`、Bode/Nyquist 绘制与判据。

### Task 5: 单元 `1-5` 讲义

**Files:**
- Create: `course-content/authoring/lessons/1-5/design/handout.md`

**Requirements:**
- 主题为“平台初体验与三域联动探索”。
- 主要来源为 `course-content/runtime/lessons/legacy/L-2d/handout.md` 与 `course-content/authoring/lessons/legacy/L-2d/design/practice-guide.md`。
- 必须写成学生可独立阅读的讲义，而不是任务书或评分说明；可以保留操作步骤、观察任务和反思环节，但要去掉后台评分口吻。

### Task 6: 主代理统一审校

**Files:**
- Review: `course-content/authoring/lessons/1-1/design/handout.md`
- Review: `course-content/authoring/lessons/1-2/design/handout.md`
- Review: `course-content/authoring/lessons/1-3/design/handout.md`
- Review: `course-content/authoring/lessons/1-4/design/handout.md`
- Review: `course-content/authoring/lessons/1-5/design/handout.md`

**Requirements:**
- 检查五份讲义是否都具备问题引入、前置缺口与能力目标、原理主线、锚点案例、最小例题、分层练习、总结与扩展思考。
- 统一删去作者态、工单态、评分台本与“上一讲/下一讲”驱动叙述。
- 必要时补充封面图与信息图占位格式，使后续媒体阶段可直接接续。
