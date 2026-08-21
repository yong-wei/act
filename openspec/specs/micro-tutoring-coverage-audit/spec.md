# micro-tutoring-coverage-audit Specification

## Purpose
TBD - created by archiving change add-micro-tutoring-option-attribution. Update Purpose after archive.

## Requirements

### Requirement: 覆盖审计仅接受精确的选项级归因目录

系统 SHALL 将选项级归因目录作为合格 practice 错误选项的唯一归因来源。审计 SHALL 验证每条记录与当前题目 ID、内容哈希、错误选项及受治理学习目标和知识节点的精确一致性，并在记录无效、重复、缺失或漂移时输出 `ATTRIBUTION_UNCERTAIN`。

#### Scenario: 题目级语义与选项级目录冲突

- **WHEN** 题目级语义引用与错误选项的归因目录记录不同
- **THEN** 审计仅使用当前有效的选项级目录记录
- **AND** 不得以题目级语义作为回退归因

#### Scenario: 归因目录不完整

- **WHEN** 合格 practice 题的一个错误选项没有唯一有效的目录记录
- **THEN** 审计为该选项输出 `ATTRIBUTION_UNCERTAIN`
- **AND** 严格模式以非零状态结束
