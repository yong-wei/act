## Why

标准 Bundle 能否导入只回答合同兼容性，不能回答本次发布对对象、关系、Crosswalk、组件和投影造成了哪些语义变化。若下游继续按发布名称或全量重跑治理，未来每次发布仍会产生人工变更和不必要的重复计算。

## What Changes

- 在候选 Bundle 事务导入并完成往返验证后，由 ACT 对“上一已接受 ReleaseSet → 当前候选 ReleaseSet”重新计算结构化差异，不以文件名、固定计数或上游说明代替。
- 保存不可变 `ReleaseSetDeltaReceipt`，覆盖对象、关系、Crosswalk、组件、Projection 和词表的新增、删除及受支持变化，并与上游 `release-diff` 交叉验证。
- 对同一 Canonical ID 下的未治理类型变化、身份语义替换或缺少 supersession 的实质替换失败关闭。
- 区分语义内容更新、纯包装修订和可选 Artifact 扩展；纯包装修订只新增 Bundle Receipt，不触发课程、资源或消费者语义重算。
- 生成通用失效与增量候选信号，供课程覆盖、结构单元 Crosswalk、资源绑定、缓存和后续消费者治理使用。
- 本变更不决定课程角色、资源教学角色、教学关系，不执行 RAG/KAQ/SAR/路径/学习事实迁移，也不移动 candidate、active 或 Legacy 生产权威。

## Capabilities

### New Capabilities

- `authoritative-knowledge-release-delta`: 定义 ReleaseSet 差异复算、上游差异交叉验证、不可变回执和通用失效/增量信号。

### Modified Capabilities

无。

## Impact

- 影响候选发布导入后的差异计算脚本、差异回执持久化、候选治理任务输入和缓存失效边界。
- 以 #1125 已完成的 v0.2 候选作为可比较的冻结基线，并依赖 `import-compatible-actkg-public-bundles` 完成标准候选导入和往返验证。
- `govern-aggregate-course-coverage-and-resource-bindings` 将改为消费 Delta Receipt；首次基线全量治理，后续兼容发布只处理受影响对象和资源。
- 不改变当前候选或生产选择器。
