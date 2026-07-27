## Why

候选图谱若仍让控灵查询旧节点，会产生页面所见与回答依据不一致的问题。控灵需要识别候选 ReleaseSet 和选中 Canonical Object，但候选问答不能提前影响正式学习状态。

## What Changes

- 在候选图谱页面注入 ReleaseSet、选中 Canonical Object、页面筛选和覆盖状态。
- 为该页面提供 Canonical 搜索、对象详情和精确邻居查询，复用 Repository 与 `act.node-detail.v2`。
- 控灵回答保留候选来源与诊断信息，不从节点名称猜测 Legacy 对应项。
- 候选上下文只读，不产生学习事实、不执行路径、不更新画像，也不改变其他页面的生产知识来源。
- 只有候选控灵、V2 图谱和只读副作用门禁全部通过验收后，才向全部既有图谱用户公开候选视图并设为默认。
- 不新增专用万能投影，不扩大其他页面工具集。
- 本变更依赖 `add-candidate-authoritative-graph`。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `konling-agent-runtime`: 增加候选图谱页面的 Canonical 上下文、工具集和只读隔离要求。

## Impact

- 影响控灵页面上下文、知识图谱工具注册、回答诊断和相关集成测试。
- 不修改正式 RAG、SAR、学习路径或学习事实写入。
