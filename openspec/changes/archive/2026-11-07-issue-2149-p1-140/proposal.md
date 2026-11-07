# Proposal: issue-2149-p1-140 — 七船教学总合同阶段 A（机读步骤 schema 与评分框架）

- Issue: #2149（P1，父项 #2146；旧 24 步退役 #2155 已完成）
- 类型: 教学编排合同基础设施（多阶段；完整验收依赖七实验专项实现）

## Why

七船 20 步合同已在专项 issue（#2154/#2158–#2163）写定，需要统一的机读步骤定义 schema、现实因素开放等级与评分框架承载实现。本 change 落地合同基础设施（类型+校验+常量），七实验实现按此 schema 逐船填充，防止实现层偏离教学合同。

## What Changes（阶段 A）

1. **实验步骤机读 schema（`src/resources/simulations/contracts/experiment-step.ts`）**：18 字段类型（experimentId/version、stepId、title、learningObjective、cognitiveLevel、prerequisites、initialCondition、factorMask、studentControls 及范围、eventTimeline、runDuration/termination、measurementSignals、train/validationRole、observationWindow、requiredArtifacts、rubric、hints、retryPolicy）+ 运行时校验器（缺字段/非法枚举/范围缺失 fail-fast）。
2. **认知层级枚举**：理解/应用/分析/设计/评价/综合设计/工程判断（专项表能力层级）。
3. **现实因素开放等级常量**：P0/N0/W1/W2/V1/V2/C1/C2/E1/E2/N1/N2（数值见 #2156 阶段 A 模块），factorMask 引用这些等级。
4. **评分框架常量与类型**：每实验满分 100、20 步原始分 `[3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6,6,6,6,10]`、1–19 步三段占比（预测选择 30%/操作证据 40%/解释对照 30%，设计型步骤 40% 内对半）、第 20 步四分（模型假设 3/本人证据 3/方案比较 2/边界判断 2）＋ 校验（总分=100）。
5. **迁移表 schema**：`oldStepId → newStepId | retired`、目标变化、数据兼容性。
6. **非运行步骤显式类型**：`stepKind: 'run' | 'analysis'`——纯分析步骤不强行凑交互。

## Impact

- 新增 contracts 目录一文件 + 测试；不接线前端（随七实验实现）。
- 不建 24 步总控；不设强制主课程；七船不共享通关资格（结构上由 per-experiment 合同承载）。

## Non-Goals

- 不实现任何一船的 20 步内容（专项 issue 范围）。
- 不做互动形式 UI（#2147/#2151 相关）。
- 不做真实学生试做与用时修订（教学应用阶段）。
- 不改七专项已写定的步骤内容与分值。
