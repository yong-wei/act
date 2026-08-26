## Why

v1 严格审计和生产资格只证明 54 道 practice 题、108 个错误选项完整。#1520/#1521 已把分母扩到 135 题，但发布门禁仍不能证明 checkpoint、readiness/readiness-gate 和 remediation 错因具备可发布闭环。

## What Changes

- 新增 v2 覆盖审计合同，固定 135 题及其全部错误选项为分母，并校验阶段计数。
- 逐项验证题目、审核、选项归因、节点、资源、验证题、授权、时间预算和 fail-closed 漂移。
- 生成独立的 v2 production qualification 候选回执，与 v1 回执并存。
- 回执绑定同一捕获修订上的 Git 输入、数据库投影、测试、浏览器证据和 OCI digest。
- 资格通过只产生 candidate，不改尚未取得 v2 资格的生产选择器。

## 非目标

- 不以浏览器夹具替代服务端和数据库验证。
- 不覆盖或改写历史 v1 工件与 v1 资格回执。
- 不在本变更中激活生产 canary 或切换生产选择器。

## Capabilities

### New Capabilities

- 无。本变更扩展既有覆盖审计与生产资格能力。

### Modified Capabilities

- `micro-tutoring-coverage-audit`: 增加 v2 135 题分母、阶段计数和独立审计工件路径。
- `micro-tutoring-production-qualification`: 增加 v2 候选回执，与 v1 回执并存，且不得自动改生产选择器。
