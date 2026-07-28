## Why

生产权威切换后，新学习事实必须能够由确切的 ActKG 对象和发布版本解释；同时，历史事实不得因新图谱上线而被回填、重聚合或重新解释。

## What Changes

- 定义 Canonical 新事实引用：Canonical ID、活动聚合 ReleaseSet/Release、projection/知识修订身份均为必需。
- 候选 ReleaseSet 禁止写入正式事实；写入边界只在最终事务切换时激活。
- 课程覆盖、有效资源绑定和 KAQ 支持范围共同约束可写 Canonical 对象。
- 历史 LearningFact、画像、诊断、风险、成长、班级聚合和已完成路径保持 Legacy 修订解释。
- 不建立历史 Canonical sidecar，不回填、不按新图重新聚合，也不双写新旧知识身份。
- 本变更依赖已接受候选 ReleaseSet、对应 `ReleaseSetDeltaReceipt`、`govern-aggregate-course-coverage-and-resource-bindings`、有效资源绑定和 `bind-kaq-to-canonical-knowledge`；当前结果仍只允许影子验证。

## Capabilities

### New Capabilities

- `canonical-knowledge-learning-fact-identity`: 定义切换后新事实的 Canonical 身份、版本和写入门禁。

### Modified Capabilities

- `adaptive-learner-state-service`: 增加 Canonical 写入边界与历史 Legacy 事实冻结要求。

## Impact

- 影响 LearningFact 写入适配器、数据库约束、生产者目录、画像聚合选择器和数据治理测试。
- 实际激活由最终切换变更负责，前序实现只能影子验证。
