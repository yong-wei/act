## Why

当前 54 题微辅导基线只覆盖 practice-v1，不能代表 576 道目录题目或完整学习周期；运行时也没有可执行的 terminal-validation scope。平台需要在不改变 v1 分母的前提下，建立按学习目标、阶段和题源版本化的 v2 覆盖合同。

## What Changes

- 建立 readiness、practice、checkpoint、remediation 和 terminal-validation 五阶段的版本化覆盖矩阵。
- 分别报告原始目录、人工审核、path eligibility、运行时注册和实际可选题目，禁止把 `allowedStages` 当作已批准或可运行证明。
- 按学习目标、题源和阶段定义最低覆盖、独立性、退役及分母升级规则。
- 为 terminal validation 增加显式运行时 scope、独立选择和学生安全投影，但不改变既有 practice-v1 审计结果。
- 用新 baseline/version 发布 v2；题目新增、内容变化或来源纳入均须显式审核和漂移报告。

## Capabilities

### New Capabilities

- `adaptive-assessment-lifecycle-coverage`: 定义完整学习周期的版本化题库覆盖矩阵、阶段门禁、分母升级和审计语义。

### Modified Capabilities

- `adaptive-assessment-item-catalog`: 目录明确区分允许阶段、人工批准阶段、运行时注册状态和生命周期覆盖版本。
- `adaptive-learning-path-planning`: 路径规划支持受治理 terminal validation，并在阶段候选缺失或漂移时 fail closed。

## Impact

- 影响评估目录/审核工件、AdaptiveQuestionScope、题目选择、路径规划和题库治理报告。
- 不修改 practice-v1 的 54 题分母，不在本变更中改变掌握度算法或生产启用微辅导。
