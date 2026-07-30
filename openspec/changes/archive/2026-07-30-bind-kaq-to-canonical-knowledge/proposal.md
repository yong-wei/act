## Why

KAQ 的知识角色仍承担知识—能力—素养治理，不能被 ActKG 工程图谱整体替代；但其知识身份必须离开 Legacy 节点。还需要为未来 ActKG Teaching Projection 接管知识—知识教学关系预留单一权威边界。

## What Changes

- 让 KAQ 知识角色通过带 Release、绑定角色和审核状态的显式关系指向 Canonical Object。
- 保留 KAQ 的知识—能力—素养、目标和运行教学语义，不把这些关系写入 ActKG 工程本体。
- 禁止从旧 ID 或名称自动继承 Canonical 绑定。
- 接入未来 ActKG Teaching Projection；其正式发布后由 ActKG 拥有包含、先修、关联等知识—知识教学关系。
- Teaching Projection 与既有 KAQ 知识关系冲突时执行一次性审核，确认后退役对应 KAQ 旧关系，不长期并行。
- 切换前 Canonical KAQ 绑定和 Teaching Projection 只用于影子验证，正式 KAQ 消费者继续使用 Legacy authority selector。
- 本变更依赖标准候选导入、对应 `ReleaseSetDeltaReceipt` 和 `govern-aggregate-course-coverage-and-resource-bindings`；候选 ReleaseSet 未提供正式 Teaching Projection 时，本变更不能把工程谓词当作教学关系。

## Capabilities

### New Capabilities

- `canonical-knowledge-kaq-binding`: 定义 KAQ 知识角色的 Canonical 绑定及 Teaching Projection 接管边界。

### Modified Capabilities

- `kaq-graph-schema`: 将 KAQ 知识身份解析到 Canonical Object，同时保留能力与素养关系所有权。
- `autocontrol-kaq-graph-catalog`: 增加 Canonical 绑定的版本、审核和覆盖门禁。

## Impact

- 影响 KAQ 图谱模型、目录校验、绑定审计和教学关系冲突迁移。
- 不迁移历史事实，也不从工程关系推断先修或包含。
