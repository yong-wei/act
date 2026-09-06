## Why

生产环境 `authority-learning-content-manifest` 仍停留在 v1（仅登记 2 个节点），而运行态解析器 `src/lib/authority-domain-shards/learning-content.ts` 要求 `act-authority-learning-content-manifest/v2` 契约，否则 `readManifest` 返回 null、`resolveNodeLearningContent` 对全部节点返回 unavailable；readiness 分类器 `src/lib/knowledge-surface/learning-content.ts` 把 v1 一律判为 `version-drift`。结果：全部 Authority 节点的知识卡/信息图面板整组不可用。

运行态磁盘上已有 1236 张卡（`cards/authority/nodes/*.md`）与 1235 张信息图（`infographs/authority/nodes/*.png`），v2 导出脚本 `scripts/knowledge/export-authority-learning-content-v2.py` 也已存在。但它不写 `teachingProjectionId`/`teachingProjectionHash` 印章（当前清单上的印章是脚本外手工补写的，无任何脚本产生）；同时 `scripts/runtime-release/` 的 blob 打包从 Git 快照构建，而卡/图文件未入库（Git 仅跟踪 1 节点夹具），v2 导出从未进入发布流水线——这是生产 v1 滞留的根因。

## What Changes

- **teaching 印章脚本化**：v2 导出把 domain-fragments overlay `current.json` 的 `projectionId`/`projectionHash` 写入清单，消除脚本外手工补写；印章缺失、过期或与 overlay 不一致时 linkage 门禁 fail-closed。
- **发布链纳入**：v2 导出 + 印章 + `check-authority-surface-linkage` 校验进入 `deploy:runtime` 内容发布链；卡/图/清单经 external input bundle 通道（textbooks 已有先例）进入 blob release 闭包，取代 Git 快照中的 1 节点夹具。导出对空运行态卡目录 fail-closed，防止发布空清单。
- **缺图节点策略明确**：有卡无图的 1 个节点（`ctkg:v3e-object-8c4354096b719a1d5e090da4`，Laplace transform）在清单中登记 `infograph.state: missing`，不阻断导出；无卡之图、重复身份、未映射 canonical、哈希漂移仍 fail-closed。
- **readiness 对齐验证**：v2 契约 + authority 身份四元组 + teaching 信封三者匹配才判 `available`，其余一律 fail-closed；以测试与门禁脚本证明分类器与消费侧解析器判定一致。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `authority-card-infograph-inspector`：生产供应的清单必须是覆盖完整运行态卡/图集、带脚本化 teaching 印章的 v2 导出；v1、夹具规模或手工编辑的清单按 version-drift/malformed fail-closed。
- `authority-surface-complete-linkage`：teaching 印章必须由脚本产生且等于活跃 overlay 信封；v2 导出与 linkage 门禁必须纳入运行态发布链，release 闭包必须包含清单引用的全部资产。

## Impact

影响 `scripts/knowledge/export-authority-learning-content-v2.py`（印章 + 缺图策略 + 空集保护）、`scripts/knowledge/check-authority-surface-linkage.mjs`（纳入发布链强制执行）、`scripts/runtime-release/` 与 `src/lib/runtime-external-input-bundle.ts`（新增 learning-content 外部输入通道）、`course-content/runtime/knowledge/authority-learning-content-manifest.json` 及 1236 卡 / 1235 图资产的发布闭包，以及对应测试。

不改消费侧解析器与 readiness 分类器实现（已就绪，仅补对齐验证）；不改卡/图内容本身；不执行生产发布——生产发布步骤列入 tasks，执行时单独授权。
