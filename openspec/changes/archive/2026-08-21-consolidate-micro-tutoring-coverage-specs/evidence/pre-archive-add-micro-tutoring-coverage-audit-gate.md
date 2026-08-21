# Pre-archive evidence for add-micro-tutoring-coverage-audit-gate

Captured: 2026-08-21T05:32:55Z
HEAD: 606846ce6e2ce5fc54811f14fb75c7801e5fda9f

## 1. Active change still present

Path: openspec/changes/add-micro-tutoring-coverage-audit-gate/

## 2. Task completion

- [x] 1.1 定义选项级归因审计源、54 项题目 ID/内容哈希基线及其严格校验。
- [x] 1.2 提取资源与验证题的受治理资格纯逻辑，并保持现有微辅导编排行为不变。
- [x] 2.1 实现合格常规练习分母、错误选项行、缺口分类和确定性 JSON/Markdown 报告生成。
- [x] 2.2 实现只读数据库投影适配、报告/严格模式 CLI 及 package 脚本入口。
- [x] 3.1 为基线漂移、重复项、归因/资源/验证题缺口、独立性与稳定排序补充单元测试。
- [x] 3.2 为命令产物、严格失败和不泄露题目答案补充脚本级回归测试。
- [x] 3.3 运行目标测试、类型检查与 OpenSpec 严格验证；确认审计和严格失败行为，54/54 全覆盖严格通过由 #1392–#1395 继续完成。

## 3. Canonical spec Purpose and requirements before archive

### Purpose
# micro-tutoring-coverage-audit Specification

## Purpose
TBD - created by archiving change add-micro-tutoring-option-attribution. Update Purpose after archive.

## Requirements

### Canonical requirement headings
8:### Requirement: 覆盖审计仅接受精确的选项级归因目录

### #1391 delta requirement headings
3:### Requirement: 定义稳定的合格常规练习分母
39:### Requirement: 审计每个错误选项的微辅导链路
77:### Requirement: 提供确定性的报告与严格门禁
99:### Requirement: 将覆盖审计纳入可重复验证

## 4. Gap

Canonical spec currently contains only the #1392 option-attribution requirement.
The four #1391 requirements are absent from canonical spec and remain in the active change.
