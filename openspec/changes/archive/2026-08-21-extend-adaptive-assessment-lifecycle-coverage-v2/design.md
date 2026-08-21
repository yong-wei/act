## Context

题目目录登记 576 个项目，人工批准和 path eligibility 又是不同维度；practice-v1 只冻结 54 道题。现有 catalog 已声明 terminal-validation 语义，但运行时 `AdaptiveQuestionScope` 没有对应 scope，容易把目录“允许”误读成完整学习周期“可用”。

## Goals / Non-Goals

**Goals:**

- 建立五阶段、九学习目标和各题源的可审计 v2 矩阵。
- 用新版本扩展覆盖，不改写 v1 结果。
- 增加受治理的题目型 terminal validation，并与仿真/Arena terminal validation 并存。

**Non-Goals:**

- 不要求 576 道题全部 path-eligible。
- 不把每个题源强制配成相同数量。
- 不修改掌握度算法或把微辅导结果直接作为终结性证据。

## Decisions

1. **分别报告登记、审核、资格、注册和可选择状态。** 矩阵单元以 learning goal × stage × source family 表示，禁止由 `allowedStages` 推断人工批准或运行时可用。
2. **v2 使用新的基线版本和 release identity。** v1 的 54 题和哈希保持不可变；v2 记录每阶段分母、来源策略、限制和工件摘要。
3. **terminal validation 是独立 scope。** 题目型 terminal validation 只选择人工批准、path-eligible、明确用于 terminal-validation 的题；它可以与 simulation/Arena 终结验证组合，但不能代替后者的领域任务证据。
4. **最低覆盖是配置化治理策略，不是代码常量。** 每个学习目标/阶段的要求随 baseline version 发布，缺口产生 limitation，不由生成题补齐。
5. **题目身份沿用 catalog 和答题快照。** 新阶段不创建第二套题目 ID；选择后仍封存 `AdaptiveAssessmentItemRef`。

## Risks / Trade-offs

- [扩张分母导致 v1 门禁失效] → v1/v2 工件、命令和报告并存，任何升级必须显式选择版本。
- [terminal validation 与 checkpoint 重复] → 审核包要求声明阶段目的和独立性 rationale，不能一条审核决定同时隐式授权多个高风险阶段。
- [来源分布不均] → 报告 source mix 和 limitation，但质量优先于人为均匀配额。

## Migration Plan

1. 只读生成 v2 inventory，核对九目标和五阶段现状。
2. 人工批准新增/重分类题目并补齐 terminal-validation 缺口。
3. 增加 runtime scope 和选择器，在 feature flag 下运行影子选择。
4. v2 严格审计和生产资格通过后另行授权激活；回滚继续使用 v1/prior stage policies。

## Open Questions

- 各阶段最低题量在 inventory 出具后由课程教学审核确定，提案不预设高于现有 3/6/3/3 的数值。
