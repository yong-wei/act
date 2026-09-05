## Why

v0.37 工程权威没有先后修谓词。领域 overlay 只有 7 条审核先修，课程先修出版物另有 139 条讲义边，课程投影还有 891 条资源绑定。三套节点几乎不重叠，默认画布读 overlay，课程序读不到。教学顺序必须以课程内容为准，并只保留一层教学投影。

## What Changes

- **BREAKING**：领域默认教学顺序的骨架改为**课程内容相关 DomainConcept + 课次单元顺序**，不再把工程 `post-requisite` 当必选骨架（v0.37 中该族为空）。
- 唯一活教学投影是 domain-fragments composed Teaching Projection。并入课程先修 139 条；课程先修出版物不再单独充当顺序真源。`/knowledge` 与后续资源绑定读这一层。
- 第一波节点分母 = 领域概览 DomainConcept ∩（课程投影绑定 canonicalId ∪ 课程先修核心/端点）。未出现在教学内容中的概览点不进本层，不强制 1555 点全连通。
- 在已发布课程先修之上，按 syllabus 单元顺序（`1-1`→…）把同一领域内尚未连通的内容相关节点用 `RECOMMENDED` 扩展边串联。不得用 Canonical ID 冒充教学顺序。
- 其它教学资源覆盖保持增量：本层先钉内容相关领域概念，卡/信息图/其余资源按该分母后续挂接（#2008）。
- 运行时仍不得从 live 工程分片推断教学边。不改 Engineering 字节，不切换生产 selector。

## Capabilities

### New Capabilities

- `domain-teaching-order-coverage`：内容相关概览节点的教学顺序覆盖——课程先修并入、单元顺序扩展、相关子集弱连通、无关概览点允许 empty。

### Modified Capabilities

- `incremental-domain-teaching-projection`：默认教学层以课程内容相关子集为分母；无关概览点的 empty 不阻断。
- `act-teaching-prerequisites`：必须并入已发布课程 `PREREQUISITE`；工程先后修若存在仍可采纳，但不得替代课程序。
- `layered-authority-domain-workspace`：默认教学顺序层展示这一层已发布教学边。

## Impact

重写 domain-fragments 组合与 overlay。课程 `prerequisites` 出版物仍可留作历史，但顺序真源迁到 domain-fragments。不改 Engineering JSON、生产 selector。
