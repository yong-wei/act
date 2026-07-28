## Context

ACT 当前发布锁、验证器、候选选择器和夹具都围绕固定发布版本形成。ActKG 新的公开包合同将 `bundle_contract_version`、Artifact role/profile/contract、组件清单、Projection Link Metadata、Schema 快照和校验信息放入 Manifest，使“合同兼容”与“内容版本变化”可以分开判断。

#1125 已由 PR #1128 完成并归档：`control-theory-engineering-v0.2` 已按固定 CTKG 0.2 合同导入，Repository、候选图谱和候选态控灵已接入该 ReleaseSet。该结果应保留为历史精确适配基线，本变更在其外部增加标准兼容边界，不改写其数据、回执、契约或回归夹具。当前 v0.3 包还缺少完整组件 `release_id`、Manifest 和稳定 source tag，必须由 ActKG 形成包装修订后才能作为通过夹具。

## Goals / Non-Goals

**Goals:**

- 用一个稳定入口识别历史精确包与 `actkg-public-bundle/1` 标准包。
- 让受支持合同下的内容、组件、投影和计数变化只需更新受控包与 Lock。
- 对未知合同、未知 Schema、完整性失败和隐私越界给出确定、失败关闭的裁决。
- 产出不依赖 Prisma 或运行时 DTO 的完整验证结果。

**Non-Goals:**

- 不写数据库，不创建候选 ReleaseSet，不移动任何 selector。
- 不计算版本差异，不执行课程覆盖或资源绑定治理。
- 不把工程关系转换为 Teaching Projection，不修改图谱页面或控灵。
- 不在 ACT 内修复或重打包上游发布物。

## Decisions

1. **显式 Lock 是唯一发现入口。** ReleaseSet Lock v3 记录受控包路径、Bundle/Release/Schema 身份和原始 Manifest 哈希。运行时不得扫描目录、选择最大版本或使用 `latest`。候选包可以通过显式开发参数验证，但不得成为自动候选。
2. **路由只看 Manifest 存在性和声明合同。** 无 Manifest 的已知历史包进入冻结的 `LegacyExactV02Adapter`；存在 Manifest 时必须进入标准适配器。标准包校验失败不得回退历史适配器，否则损坏包会绕过新门禁。
3. **兼容性注册表使用复合身份。** 注册键至少包含 Bundle 合同版本、Schema 版本与原始哈希，以及所有必需 Artifact 的 role/profile/contract。仅比较 `schema_version` 会把同版本异内容误判为兼容。
4. **Artifact 按角色发现。** 文件名只作为 Manifest 中受校验的相对路径；解析逻辑按 role、profile、contract_version 和 required 选择。未知必需项裁决为 `ADAPTER_UPDATE_REQUIRED`，未知可选项原样携带但不启用语义。
5. **Projection 分别保存和验证。** 标准包可包含 runtime、domain、review 等多个 Projection；只有注册为 runtime 的 profile 进入候选运行投影，其他 Projection 仍保留原始身份和字节。Link Metadata 必须与其声明的 Projection profile 和全部关系形成闭合。
6. **验证顺序从字节到语义闭合。** 先验证路径、Manifest、`SHA256SUMS`、哈希、长度和记录数，再验证 Schema、Release、组件、Projection、Metadata、Crosswalk、动态统计和隐私边界。额外磁盘文件、重复/大小写冲突路径、绝对路径、`..`、反斜杠或符号链接逃逸均拒绝。
7. **验证输出是一条稳定内部合同。** `ValidatedActKGBundle` 包含四类身份、选定 runtime Projection、保留 Projection、Metadata、Crosswalk、组件、原始 Artifact、复算统计和兼容裁决；后续导入器不得再读取文件名或自行解释原始包。
8. **普通发布与合同变更分流。** `COMPATIBLE_CONTENT_UPDATE`、`COMPATIBLE_PACKAGING_REVISION` 和 `COMPATIBLE_OPTIONAL_EXTENSION` 通过发布接入流程处理，不开新的 OpenSpec。未知必需合同进入 `ADAPTER_UPDATE_REQUIRED`，未知 Schema 身份进入 `SCHEMA_REVIEW_REQUIRED`，完整性错误进入 `INTEGRITY_REJECTED`。

## Risks / Trade-offs

- [Lock 更新仍需要仓库提交] → 将其视为受控发布数据更新，而不是新功能变更；校验和审核回执绑定提交修订。
- [Manifest 合同初期仍可能调整] → 注册表只支持明确身份，不提供宽松兼容；协议变化以新适配变更处理。
- [历史包形状与标准包差异大] → 冻结历史适配器，只允许读取已知无 Manifest 包，不让历史条件分支污染标准适配器。
- [上游 v0.3 当前不能通过] → 把 r2 包装修订列为外部前置条件，负向夹具保留当前缺失组件身份的失败证据。

## Migration Plan

1. 固定 `actkg-public-bundle/1`、CTKG Schema 0.2.0 及所需 Artifact 合同快照和原始哈希。
2. 实现 Lock v3、Router、兼容注册表和标准验证器，并保留历史精确夹具。
3. 使用上游 v0.3 r2 与合成 v0.4 夹具覆盖内容更新、包装修订、可选扩展和全部拒绝类别。
4. 在不写数据库的条件下生成确定性验证报告，作为后续候选导入的唯一输入。
5. 若标准兼容层失败，删除未消费的验证产物即可；现有数据库和运行时不受影响。

## Open Questions

无。上游 v0.3 r2 的稳定 commit/tag 是实施前置证据，不是本变更内的设计选择。
