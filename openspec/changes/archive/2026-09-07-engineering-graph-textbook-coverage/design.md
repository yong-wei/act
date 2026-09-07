## Context

工程图谱 Authority 位于 `course-content/authoring/knowledge/authority/`，激活 release `ctr:release:control-theory-engineering-v0.37`（快照 `snap-e2d8b92f…`，7476 对象 / 3047 关系 / 17 个组件域）。组件 release 格式本身支持 `evidence_segment_stubs`/`source_object_stubs`/`source_mappings`，但只有 `root-locus-engineering-v0.1` 一个组件带有 125 条 canonical→source 映射；激活快照构建脚本 `build-v037-authority-snapshot.ts:740` 恒写 `sourceMappings: []`，物化 `materialize.ts:569` 恒写 `sources: []`。而消费侧早已就绪：DB 模型 `ActkgSourceObject`/`ActkgSourceMapping`/`ActkgEvidenceSegment`/`ActkgEvidenceStructuralUnitCrosswalk`、repository 读取路径（`repository.ts:1049-1087`）、节点详情契约 `sources` 字段、前端 `presentSourceCitation` 全部存在，只差数据。

教材侧：教学投影教材通道 `source-resource-crosswalk.jsonl` 仅 6 行 locator（契约 `act-textbook-source-resource-crosswalk/v1`），authority binding 钉在旧 v0.12；`runtime-full-binding.ts:308-319` 消费该文件。教材运行时为 `course-content/runtime/resources/textbooks-v2/` 七本书，统一阅读器路由 `/textbooks/<bookId>/<edition>/<unitPath>`（`buildTextbookReaderHref`），混合检索索引 `textbook-hybrid-retrieval/bge-m3` 共 13292 窗口。书籍 id 两套不一致：投影/Authority 用 `dorf-modern-control-systems-14th`、`franklin-feedback-control-7th`、`hu-shousong-auto-control-8th`；阅读器登记 `dorf-modern-control-systems`、`feedback-control-of-dynamic-systems`、`hu-shousong-auto-control-8th`。

## Goals / Non-Goals

**Goals:**

- 7476 个工程图谱对象到三本教材 v2 结构单元的全面映射，覆盖率（approved 映射 + 显式例外）≥95%，fail-closed 门禁。
- 映射坐标统一为 textbooks-v2 structuralUnit 坐标（`structuralPath`/`structuralUnitId`），画布出处、未来控灵引用、阅读器跳转、混合检索落在同一 URL 体系。
- 运行时 textbook 通道扩量消费；物化 node-detail `sources` 填充，画布零前端改动显示出处并可跳阅读器。
- 全部映射治理留痕：候选、评审结论、例外原因可审计。

**Non-Goals:**

- 不接线控灵消费侧（Change 6）；不改工程图谱拓扑与 overlay A 关系。
- 不扩展三本提取源以外的教材；不把 v1 locator 行删除（保留兼容）。
- 不重建/替换 v0.37 激活快照身份，不执行生产发布与部署（仅列步骤、另行授权）。

## Decisions

1. **映射坐标采用 textbooks-v2 structuralUnit 坐标，v1 locator 保留兼容。** 新映射行记录 `bookId`/`edition`/`structuralUnitId`/`structuralPath`，可直接喂 `buildTextbookReaderHref`；crosswalk 契约扩展为 v2（`act-textbook-source-resource-crosswalk/v2`），v1 行继续可消费。备选是继续用 v1 SourceAnchor locator 再桥到 v2；拒绝，因为 SourceAnchor 是 ActKG 侧节定位身份，与阅读器 URL、混合检索窗口坐标不同源，桥接会制造第二套坐标。

2. **候选生成 = 混合检索召回 + 检索词词典，评审 = 独立语义评审账本。** 对每个 canonical 对象用标签/别名/教学字段经 bge-m3 索引召回候选结构单元，叠加 `aggregate-governance/act-crosswalk.ts` 检索词词典扩充查询；候选逐条经独立语义评审（复用 course-coverage aggregate review 账本模式，该模式已跑通 1121 条），结论 `approved`/`rejected` + 理由落不可变追加账本。禁止仅凭字符串/向量相似度直接生成 approved 映射。

3. **无映射节点进显式例外账本，不允许静默无映射。** 例外按原因分类（如无对应教材内容、候选全部评审拒绝、对象类型不适合教材出处）；例外与 approved 合并计入覆盖率分母，覆盖率低于 95% 时门禁 fail closed，需人工审查后才能豁免。

4. **crosswalk authority binding 重钉 v0.37。** 新 crosswalk 行的 `authorityReleaseId`/`authorityReleaseHash`/`bundleDigest`/`captureRevision` 绑定当前激活 release `ctr:release:control-theory-engineering-v0.37`；钉旧 release 的行不得进入运行时消费。

5. **书籍身份经显式别名表解析。** 别名表维护投影 sourceDocumentId → 阅读器 `bookId` + `edition`（如 `dorf-modern-control-systems-14th` → `dorf-modern-control-systems` / `14th Global Edition`）；解析目标必须存在于 v2 运行态 manifest，否则 fail closed，不回退猜测。

6. **REFERENCE_ONLY 语义：locator 不内嵌正文的语义不变，但允许打开站内阅读器。** `REFERENCE_ONLY` 表达的是投影/RAG 载荷不携带教材正文（`consumers.ts` 的 `locator-only-reference-governed` 排除理由保持）；站内阅读器打开的是已按课程授权门控（`authorizeTextbookAccess`）的 v2 运行态内容，与 accessMode 正交。因此映射产出的出处链接允许指向阅读器 href，正文访问仍由阅读器自身授权门控。**此决策需在实现前由用户确认**（见 Open Questions）。

7. **物化 sources 由治理账本经显式输入注入，不改快照身份。** `materialize.ts` 增加可选的已治理映射输入（类似 teaching overlay 的注入方式），node-detail `sources` 由评审通过的账本填充；同时物化不再丢弃快照自带的 `sourceMappings`/`sourceObjects`/`evidence`（未来快照版本填充时必须保留）。不为填数据而重建 v0.37 快照或切 release，避免触碰 authority 身份治理面。备选是重建快照填充；拒绝，因为快照不可变且激活切换属于另一条治理链。

## Risks / Trade-offs

- [候选召回噪声大] → 混合检索只产出候选；approved 必须过独立语义评审账本，评审拒绝的候选留痕可重召。
- [detail 分片超 payload budget] → 每节点 sources 设条数上限（超出取评审置信度最高者并进例外账本备注）；budget 断言随字段扩容显式调整，不静默放宽。
- [别名表/版本漂移] → 别名解析与 v2 manifest 校验脚本 fail-closed；教材重导出版本变化时映射账本按 `structuralUnitHash` 失效重审。
- [7476 对象评审成本高] → 按 17 个组件域分批评审、分批入账；覆盖率门禁按域报告，单域不达标不阻断其他域入账，但阻断运行时消费切换。

## Migration Plan

1. 本地生成候选 → 独立语义评审 → 例外账本，跑覆盖率门禁与 linkage/identity 校验。
2. 契约扩展 + 运行时通道 + 别名/坐标解析 + 物化 sources 填充，跑聚焦测试与 typecheck。
3. PR 合入 `integration`。
4. 生产内容发布（重新物化分片、投影重发布）步骤列入 tasks，执行时单独授权。
5. 回滚：物化与投影指针拨回本变更前的分片集与投影身份；映射账本为新增工件，不参与旧身份。

## Open Questions

- REFERENCE_ONLY 是否允许站内阅读器打开：design 决策 6 按"允许打开、正文仍由阅读器课程授权门控"记录，实现前需用户确认。
