## Why

SAR 需要同时利用权威知识、KAQ、资源、路径和学习状态，但这些数据具有不同权威来源。复制成一张混合图会丢失治理边界并形成第二真源。

## What Changes

- 请求期间分别查询 AuthoritativeKnowledgeRepository 与 ACT 的 KAQ、资源、路径和学习状态 Overlay。
- 只沿聚合 ReleaseSet 下经审阅的显式类型化绑定和 SAR 明确支持的谓词执行有限跳扩展，并保留 namespace、authority、ReleaseSet/Release 或 Overlay 版本。
- 组合结果是面向当前请求的可重建候选投影，不回写为工程关系、教学关系或统一图谱。
- 未支持的对象类型和谓词不得自动参与 SAR 计算。
- 切换前 Canonical SAR 只运行影子查询，正式 SAR authority selector 继续使用 Legacy 实现。
- 本变更依赖 `adopt-ctkg-0-2-aggregate-release-contract`、`govern-aggregate-course-coverage-and-resource-bindings` 和 `bind-kaq-to-canonical-knowledge`。

## Capabilities

### New Capabilities

- `canonical-knowledge-sar-composition`: 定义 SAR 跨权威查询组合、来源标记和非物化边界。

### Modified Capabilities

无。

## Impact

- 影响 SAR 查询计划、类型化边界、候选缓存、诊断和集成测试。
- 不修改各来源真源，不建立长期混合图数据库。
