# 微辅导 v2 资源与独立验证闭环

为 v2 的 135 道已审核自适应题补齐受治理学生资源和独立验证题，使每个错误选项都能形成可执行的 5–10 分钟微辅导任务。保留 v1 工件与历史资格语义。

## 范围

- 生成 v2 错因到资源的投影，绑定 registry 身份、资源修订、学生访问路径和捕获修订。
- 为每个 v2 目录题注册独立的同目标验证题，禁止复用来源题身份或内容哈希。
- 验证用途决定必须来自独立审核工件；缺失或身份漂移时 fail-closed。
- 资源撤销、内容漂移、重复、不可访问和时间预算违规时继续 fail-closed。

## 非目标

- 不修改页面视觉、文案或历史答题记录。
- 不把 v2 严格覆盖审计或生产资格切到 135 题分母；那是后续 Issue。
- 不创建脱离 TeachingResource、资源 registry 或评估目录的正文权威。

## Capabilities

### New Capabilities

- 无。本变更扩展既有资源投影与验证注册表，不新增独立能力名称。

### Modified Capabilities

- `micro-tutoring-resource-registry`: 当前投影消费 v2 选项归因目录，覆盖全部当前错误选项错因。
- `micro-tutoring-validation-registry`: 当前注册表覆盖 135 道 v2 基线题，并强制独立验证用途审核工件。
