# experiment-teaching-contract Specification

## Purpose
TBD - created by archiving change issue-2149-p1-140. Update Purpose after archive.
## Requirements
### Requirement: 七船统一机读步骤合同

每船实验步骤 MUST 由统一机读 schema 承载，至少包含 issue #2149 §4 列出的字段（experimentId/version、stepId、title、learningObjective、cognitiveLevel、prerequisites、initialCondition、factorMask、studentControls 及范围、eventTimeline、runDuration/termination、measurementSignals、train/validationRole、observationWindow、requiredArtifacts、rubric、hints、retryPolicy）；校验器 MUST 在缺字段、非法枚举或参数范围缺失时拒绝该步骤定义；纯分析步骤 MUST 显式标记 stepKind=analysis 且 MUST NOT 被要求产生运行证据。

#### Scenario: 非法步骤定义拒绝

- **WHEN** 步骤缺 measurementSignals 或 studentControls 无范围
- **THEN** 校验器返回对应字段错误，该定义不得进入运行时

### Requirement: 冻结评分框架

每实验总分 MUST 为 100；20 步原始分 MUST 等于固定分布 `[3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6,6,6,6,10]`；1–19 步三段占比 MUST 为预测/选择 30%、操作与证据 40%、解释对照 30%（设计型步骤的 40% 对半分为性能与证据质量）；第 20 步 MUST 为模型假设 3、本人证据 3、方案比较 2、适用边界 2；评分框架常量的任何变更 MUST 使校验失败（显式修合同，防漂移）。

#### Scenario: 分值分布漂移检出

- **WHEN** 任一步骤分值被改动导致分布不等于冻结值
- **THEN** 评分校验失败

### Requirement: 现实因素开放等级与隔离

现实因素 MUST 引用 #2156 定义的等级常量（P0/N0/W1/W2/V1/V2/C1/C2/E1/E2/N1/N2）；七船 MUST NOT 共享通关资格（每实验独立完成判定）；MUST NOT 存在要求先完成其余六船的前置条件。

#### Scenario: 跨船前置拒绝

- **WHEN** 步骤 prerequisites 引用另一实验的步骤
- **THEN** 校验器拒绝

