## Why

ActKG 的语义 Schema 可以保持稳定，但公开包会持续新增模块、关系、投影和包装修订。若 ACT 继续按发布版本编写专用适配器，每次图谱发布都需要新的代码变更，发布合同也会被文件名和固定计数绑死。

## What Changes

- 建立 `actkg-public-bundle/1` 的 Manifest 驱动兼容层，以显式 ReleaseSet Lock、Bundle Router、合同注册表和 Artifact 角色发现替代按目录名、文件名或“最新版本”猜测。
- 保留无 Manifest 的 CTKG 0.2 精确适配器作为历史兼容入口；带 Manifest 的标准包只能走标准适配器，标准校验失败时不得回退历史适配器。
- 分离 Bundle、Release、ReleaseSet 和 Projection 四类身份，验证 Schema 身份、Artifact 合同、组件闭合、Release 成员、Projection、Link Metadata、Crosswalk、校验和、路径安全、隐私边界和动态统计。
- 对未知必需 Artifact、未知必需合同或未知 Schema 身份给出明确的适配/审核裁决；未知可选 Artifact 仅原样保存，不自动启用运行语义。
- 输出与存储无关的 `ValidatedActKGBundle`，供后续候选导入变更消费；本变更不写数据库、不修改 Repository、API、候选图谱、控灵或生产选择器。
- 以修复组件身份并补齐 Manifest 的 `control-theory-engineering-v0.3` 包装修订作为标准正向夹具；上游重打包是接入前置条件，不由 ACT 静默修补。

## Capabilities

### New Capabilities

- `actkg-public-bundle-compatibility`: 定义标准公开 Bundle 的路由、身份、合同注册、Artifact 发现、完整性验证和兼容性裁决。

### Modified Capabilities

- `authoritative-knowledge-release-ingestion`: 将可接纳输入从固定版本专用文件形状升级为受显式 Lock 和受支持公开 Bundle 合同约束的验证结果。

## Impact

- 影响 `scripts/actkg-release/` 的验证入口、ReleaseSet Lock 结构、受控合同快照、Schema/Manifest 校验器和固定测试夹具。
- #1125 已完成的 CTKG 0.2 精确适配器、候选数据和回执保持冻结；后续 `import-compatible-actkg-public-bundles` 消费标准验证结果并完成候选导入。
- 兼容内容更新只需新增受控包与 Lock 数据，不再增加版本专用代码。
- 不改变数据库、运行时消费者、Legacy 权威和生产行为。
