## ADDED Requirements

### Requirement: 覆盖审计正式规范保持完整归档 lineage

系统 SHALL 仅在已完成 change 的全部要求均已进入 `micro-tutoring-coverage-audit` 正式规范、Purpose 已描述实际能力且 GitHub 完成状态与归档路径一致时，将覆盖审计治理状态判定为已整理。历史归档工件 MUST 保持不可变，缺失要求 SHALL 通过原 change 的标准归档进入正式规范，不得以无来源手写替代。

#### Scenario: #1391 与 #1392 要求完整进入正式规范

- **WHEN** 规范整理验证运行
- **THEN** 正式规范同时包含固定 54 题分母、逐错误选项链路、确定性严格门禁、可重复验证和精确选项级归因要求
- **AND** 每组要求均可追溯到对应归档 change

#### Scenario: Issue 状态领先于规范归档

- **WHEN** Issue 已标记 archived，但其完整要求仍只存在于活动 change 或正式规范 Purpose 仍为占位文本
- **THEN** 系统 SHALL 报告治理状态不一致
- **AND** 不得把该状态作为后续生产资格的正式规范依据
