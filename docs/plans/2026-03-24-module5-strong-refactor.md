# Module5 Strong Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将模块5从“前沿专题并列骨架”重构为“知识边界与方法迁移层”的 6 单元确认版设计文稿，并同步回写总蓝图与决策。

**Architecture:** 本轮不是微调原有 `5-1` 到 `5-6` 标题，而是重做模块5的逻辑链。新的模块5保持 `12h / 6 单元` 不变，但调整为 `5 理论 + 1 实践`：先识别线性主干边界，再引出非线性与复杂系统链路，再推进到数据驱动与策略学习，最后用一次综合实践收束。这样既保留前沿推进，也把全课程内部实践总量压回 `18h` 约束附近。

**Tech Stack:** Markdown、课程蓝图文档、`course-content/syllabus-refactor/*`

---

### Task 1: 固化模块5强重构原则

**Files:**
- Create: `docs/plans/2026-03-24-module5-strong-refactor.md`
- Modify: `course-content/syllabus-refactor/unit-design-details.md`

**Step 1: 固定模块5角色**

- 模块5不再按“前沿方法并列专题”理解。
- 模块5固定为：
  - 知识边界识别；
  - 方法迁移判断；
  - 前沿方法比较；
  - 持续学习入口。

**Step 2: 固定不变约束**

- 仍保留 `12h / 6 单元`。
- 不把模块5写成前沿算法课。
- 强化学习只作为“方法迁移终点”的课程入口，不做算法推导课。

**Step 3: 固定实践学时约束**

- 模块5改为 `5 理论 + 1 实践`。
- 原因：
  - 模块1 `2h` 实践；
  - 模块3 `8h` 实践；
  - 模块4 `6h` 实践；
  - 模块5若保留 `4h` 实践，总内部实践将回到 `20h`；
  - 模块5收口后应把课程内部实践总量压到 `18h`。

### Task 2: 新建模块5确认版文稿

**Files:**
- Create: `course-content/syllabus-refactor/unit-design-details/module5.md`

**Step 1: 写模块级定位与四类产物接口**

- 明确模块5是“知识边界与方法迁移层”。
- 明确四类产物接口：
  - 讲义负责方法边界解释；
  - 教案负责迁移链组织；
  - 互动课程设计负责比较与判断；
  - 媒体清单负责边界失效、链路结构、方法比较的可视化。

**Step 2: 重写 6 单元骨架**

- `5-1（理论）` 线性主干的边界：饱和、死区、滞回、切换、不确定性
- `5-2（理论）` 非线性系统的最小分析入口：局部线性化、相平面、描述函数的边界角色
- `5-3（理论）` 从单回路控制到复杂自主系统链路：MASS 的感知—估计—规划—控制协同
- `5-4（理论）` 从模型驱动到数据驱动：MPC、数据驱动控制与模型依赖松动
- `5-5（理论）` 从显式控制器到策略学习：强化学习作为方法迁移终点、收益与风险
- `5-6（实践）` 方法迁移与前沿比较：同一任务下比较经典控制、数据驱动与策略学习

**Step 3: 写统一 AI 动作链与单元边界**

- 学生先独立判断“问题落在哪一层边界”。
- AI 只做比较、提示与证据整理。
- 教师基于误判分布收束“为什么该迁移 / 为什么不能乱迁移”。

### Task 3: 同步回写上位文档

**Files:**
- Modify: `course-content/syllabus-refactor/main.md`
- Modify: `course-content/syllabus-refactor/decisions.md`
- Modify: `course-content/syllabus-refactor/blueprint.md`
- Modify: `course-content/syllabus-refactor/module-skeletons.md`
- Modify: `course-content/syllabus-refactor/unit-design-details.md`

**Step 1: 更新模块5骨架与状态**

- `module-skeletons.md` 改为新 6 单元链，并把状态更新为已完成强重构。
- `unit-design-details.md` 加入 `module5.md` 入口。

**Step 2: 更新摘要与总蓝图**

- `main.md` 记录模块5的新定位和 6 单元链。
- `blueprint.md` 用总蓝图级语言替换旧的并列专题骨架。

**Step 3: 追加决策记录**

- `decisions.md` 增加一条 `2026-03-24` 决策：
  - 模块5改为知识边界与方法迁移层；
  - 结构改为 `5理论 + 1实践`；
  - 强化学习作为方法迁移终点引入，不做深算法推导。

### Task 4: 做文档级验证

**Files:**
- Verify only

**Step 1: 运行模块5一致性核验**

Run: `rg -n "模块5|5-1|5-6|强化学习|方法迁移|5理论 \\+ 1实践" course-content/syllabus-refactor/main.md course-content/syllabus-refactor/decisions.md course-content/syllabus-refactor/blueprint.md course-content/syllabus-refactor/module-skeletons.md course-content/syllabus-refactor/unit-design-details.md course-content/syllabus-refactor/unit-design-details/module5.md`

Expected:
- 模块5的新定位与新骨架在全部上位文档中可检索到

**Step 2: 运行 diff 健康检查**

Run: `git diff --check -- docs/plans/2026-03-24-module5-strong-refactor.md course-content/syllabus-refactor/main.md course-content/syllabus-refactor/decisions.md course-content/syllabus-refactor/blueprint.md course-content/syllabus-refactor/module-skeletons.md course-content/syllabus-refactor/unit-design-details.md course-content/syllabus-refactor/unit-design-details/module5.md`

Expected:
- 无空白错误、无冲突标记
