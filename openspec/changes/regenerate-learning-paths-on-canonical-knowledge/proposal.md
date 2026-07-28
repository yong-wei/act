## Why

旧未完成路径引用 Legacy 节点，不能在权威切换后继续执行，也不能按名称逐步骤映射。平台需要保留学习目标和历史解释，并在教学语义可用时生成独立的 Canonical 路径。

## What Changes

- 正式切换时停止仍未完成的 Legacy 路径，原步骤、执行和偏差记录只读归档。
- 保留旧路径声明的学习目标或用户意图，不保留旧节点序列作为新路径。
- 后续 ActKG 正式 Teaching Projection 可用后，结合当前累计画像生成具有独立身份的新 Canonical 路径；当前 `control-theory-engineering-v0.2` 聚合包不满足该门禁。
- 新路径只使用 CourseCoverage 准入对象、Canonical ID、Release 和已支持教学关系。
- 禁止工程关系自动推断教学路径，禁止旧步骤映射或路径继续执行。
- 本变更依赖 `adopt-ctkg-0-2-aggregate-release-contract`、`govern-aggregate-course-coverage-and-resource-bindings` 和 `bind-kaq-to-canonical-knowledge`；在正式 Teaching Projection 到达前只建立可验证的停止、归档和再规划等待边界。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `adaptive-learning-path-planning`: 增加 Legacy 路径停止归档、目标保留和 Canonical 路径再规划合同。

## Impact

- 影响路径身份、执行状态、归档读取、规划输入和路径验收。
- 不重算历史完成路径或把旧执行结果写入新路径。
