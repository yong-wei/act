## Why

工程图谱激活 release `ctr:release:control-theory-engineering-v0.37` 有 7476 个对象、3047 条关系、17 个组件域，但与三本提取源教材（Dorf 14th、Franklin 7th、胡寿松第 8 版）的映射只有根轨迹域 125 条 canonical→source 映射，且未进激活快照：`engineering.json` 的 `sourceMappings`/`sourceObjects`/`evidence` 全空（`build-v037-authority-snapshot.ts:740` 恒写空数组），物化 `materialize.ts:569` 恒写 `sources: []`。教学投影教材通道 `source-resource-crosswalk.jsonl` 只有 6 行 locator，authority binding 还钉在旧 v0.12。

结果：节点详情契约的 `sources` 字段（`contracts.ts`）与前端展示 `presentSourceCitation` 早已存在却没有数据，画布节点详情无法显示教材出处，学习者无法从图谱跳到教材章节，后续控灵引用教材出处（Change 6）没有数据基础。

## What Changes

- 为 7476 个工程图谱对象（按 17 个组件域）批量生成 canonical→三本教材 textbooks-v2 结构单元映射：混合检索索引（bge-m3，13292 窗口）召回候选 + `act-crosswalk.ts` 检索词词典 + 独立语义评审账本；无映射节点进显式例外账本，不允许静默无映射。覆盖率门禁 ≥95% fail-closed。
- crosswalk 契约扩展支持 v2 structuralUnit 坐标（`structuralPath`/`structuralUnitId`），保留 v1 locator 行兼容；authority binding 从 v0.12 重钉当前 v0.37。
- 运行时：`runtime-full-binding.ts` textbook 通道扩量消费新 crosswalk；教材资源经 id 别名表（投影 sourceDocumentId → 阅读器 bookId + edition）+ v2 坐标解析挂到 `buildTextbookReaderHref`；REFERENCE_ONLY 语义在 design 中确认。
- 快照/物化：物化不再恒写空 `sources`，由评审通过的映射账本填充节点详情 `sources`；激活快照自带的 `sourceMappings`/`sourceObjects`/`evidence` 在物化中必须保留。画布节点详情零前端改动显示教材出处并可跳统一阅读器。

## Capabilities

### New Capabilities

- `engineering-textbook-source-mapping`：工程图谱↔教材映射的生成管线、候选召回、独立语义评审账本、例外账本与覆盖率门禁治理。

### Modified Capabilities

- `authoritative-knowledge-repository`：快照物化保留 `sourceMappings`/`evidence`；node-detail 分片 `sources` 由治理后映射填充，不再恒空。
- `runtime-teaching-resource-binding`：textbook 通道从 6 行 v1 locator 扩量到全量 v2 structuralUnit crosswalk 行，binding 重钉 v0.37。
- `unified-textbook-reader`：投影书籍身份经别名表解析到阅读器 bookId/edition；v2 结构单元坐标解析为阅读器 href；REFERENCE_ONLY 的站内打开语义明确。

## Impact

影响 `textbook-locators` 契约与 crosswalk 工件、`runtime-full-binding.ts` textbook 通道、`structured-textbook-runtime`/`textbook-reader` 别名与坐标解析、激活快照物化（`materialize.ts` node-detail `sources`）、画布节点详情数据面。不改工程图谱拓扑、不改 overlay A、不消费侧接线控灵（Change 6）、不扩展三本以外教材、不执行生产发布（仅列步骤、另行授权）。
