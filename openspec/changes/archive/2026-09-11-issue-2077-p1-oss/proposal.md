## Why

#2033 / #2046 / #2055 已把活教学投影索引、三策略装配和事后 Runtime 绑定接进路径规划，但生成仍把已发布资源当补丁：清单快照不进入批次、同类型已发布资源每条路径只再收一条，区分度仍是 7 选 3 软标记。现网因此能产出三条近乎相同的候选，而不会诚实失败。新的 `runtime:publish` / `runtime:activate` 正在扩大可绑定池，本变更只消费该活指针，不再另建发布或清单扫描层。

## What Changes

- 路径规划开始前必须已经读到活 `PublishedResourceFeatureIndex` 与活动 Runtime release，并把本次输入快照（resourceId、content/version、objectKey 或 sourcePath、runtimeReleaseId、indexId）写入批次；索引或 release 读失败时失败关闭，不得静默改走本地默认登记表。
- 装配不再在需求满足后按类型截断已发布资源；三策略继续吃既有画像加权，优先使用尚未被兄弟路径占用的可绑定已发布节点。
- 成功生成必须恰好 3 条，且通过 #2077 硬门禁（Jaccard 相似度 ≤ 30%、每条 ≥2 个独有已发布/OSS 资源、独有占比 ≥50%、前半段至少 1 个独有、前两个非强制资源不得相同；先修 / 公共终点 / sharedRequired 不计入）。
- 不够则返回 `insufficient-candidate-diversity` 并说明原因，不得把软差异或第 4 条主族路线当成成功的三条候选。
- 既有 7 项两两指标与 Runtime 绑定/读验证继续复用，只把成功条件从 7 选 3 提升为上述硬门禁。

## Capabilities

### New Capabilities

- 无。不新增规划器、OSS 扫描器或 Runtime 发布能力。

### Modified Capabilities

- `adaptive-learning-path-planning`：规划前必须消费并快照活发布索引；装配不得按类型截断已发布资源；三条策略路径的成功条件改为 #2077 硬区分度，失败码为 `insufficient-candidate-diversity`。
- `adaptive-path-candidate-batches`：成功批次必须恰好 3 条且硬门禁通过；否则不得以成功三卡批次输出伪差异路径。

## Impact

- `src/lib/konling-agent-runtime.ts`（已有 `loadPublishedResourceFeatureIndex` / 绑定摘要，补快照与失败关闭）。
- `src/lib/published-resource-planning.ts`、`src/features/personalization/path-planning/internal/assemble-plan.ts`（删除同类型已发布截断，按 `diversityAvoidNodeIds` 优先未占用已发布节点）。
- `src/features/personalization/path-planning/adaptive-path-differentiation.ts` 与 `adaptive-path-candidate-batches.ts`（硬门禁与 limitation）。
- 既有比较投影与批次 metadata；学生 API 仍不下发原始对象键。
- 相关单测与 #2055 e2e 合同。不改 `runtime:publish` / `runtime:activate`，不改 overlay / 生产选择器，不发布 Runtime。
