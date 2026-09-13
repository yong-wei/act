## Why

当前课程投影 B′（`proj-228afa64…`，21,633 条绑定）把一个课次的全部 step、讲义、音频、视频按"资源所属课次 × 该课次节点全集"整包绑定到每个知识点（`bindToUnit()`），单个知识点最多挂 257 条资源，且不区分该知识点在教学顺序中是首次出现还是复现。节点抽屉因此列出大量与该知识点无直接关系的资源，路径规划把任何相关资源都放进候选池而不问教学顺序，音视频与讲义被统一指向课次入口页，无法定位到具体时间段或章节。绑定又与 prerequisites、coreNodes、cards 捆在一个内容哈希命名的 B′ 包里，每次重建都要整包重发，且身份无法与图谱版本直接对应。

## What Changes

- 新增独立运行态工件族「锚点化资源绑定发布」：`course-content/runtime/knowledge/resource-bindings/{current.json, releases/<bindingReleaseId>/…}`。`bindingReleaseId` 派生自 Authority 版本，格式 `<authorityReleaseId>-b<n>`（首版 `control-theory-engineering-v0.37-r6-b1`），内容哈希保留为 `bindingHash` 完整性字段。
- **BREAKING** 课程投影 B′ 不再作为资源绑定的真源：B′ 只保留 prerequisites、coreNodes、cards；抽屉、路径规划、Konling、教学资源 RAG、发布资源索引改读新绑定族。
- **BREAKING** 课次入口（`act:lesson:<unit>`）退出资源清单；音频、视频、讲义、教材等覆盖多个知识点的资源必须携带精确锚点（step、讲义章节 headingId、媒体时间段、教材小节），无锚点者不进入节点级绑定。全书级 `act:textbook:<book>` 绑定删除，仅保留 `textbook-section`。
- 每条绑定标注教学顺序语义：`appearance: first | revisit`、`teachingOrder{unitId, unitIndex, stepIndex}`、`focus`，真源为 `course-order/topics.jsonl`、课次 `manifest.json` 的 `focus_node_ids/reuse_node_ids` 与 `sequence.json`。
- 新增作者态真源：课程节点 → canonical crosswalk（220 个课程节点，未解析显式 `unmapped`），逐课 `resource-anchors/<unit>.json`（讲义章节、音频语义段、导入视频 cue、课程视频语义段，带 `provenance` 与 review 覆盖）。
- 转录进入运行态：28 课音频既有 ASR 转录/逐字时间戳、31 课导入视频的 Videos 设计文稿 cue、28 课 NotebookLM 课程视频的本机模型新转录，导出为 `runtime/lessons/<unit>/media/<unit>-<kind>.transcript.json` 并以媒体 sha256 绑定；转录只服务于锚点生成与播放定位，不进入路径规划资源池与 RAG。
- 激活锁扩展：`consumer-activation` combination 增加 `bindingReleaseId/bindingHash`；live course pointer、readiness、stage 同步校验；绑定发布 gate 对照激活运行态清单校验媒体 sha256。
- 深链：launch maps 为讲义生成 `handout-print#<headingId>`，为音视频生成 `/interactive-learning/courses/<seg>?media=<mediaId>&t=<seconds>`，step 与教材小节沿用；课次入口页解析 `media/t` 并在客户端定位；绑定中不存储任何投递 URL。
- 路径规划：目标切片规划器读取学习者掌握度；知识点无证据或 `posteriorMastery < 0.5` 只允许 `first` 资源，`≥ 0.5 且有证据` 放开 `revisit`，`≥ 0.85 且 confidence ≥ 0.6` 视为已掌握跳过；排序加入首次优先与教学顺序就近。
- 验证：三档进度（零掌握 / 部分 / 已掌握）本地学习者 seed 与路径生成对比测试；抽屉与路径深链 Playwright 验收。

## Capabilities

### New Capabilities
- `anchored-resource-binding-release`: 独立版本化的资源绑定发布族——身份派生、锚点契约、首次/复现语义、fail-closed 门禁、运行态目录与转录辅助文件、深链导航合同。

### Modified Capabilities
- `act-teaching-projection`: "Resource bindings use stable roles and identities" 增加锚点与教学顺序字段；"Consumer activation records independent combinations" 与 "Teaching resource consumers share one live course projection" 改为同时锁定绑定发布身份，B′ 不再承载 bindings。
- `runtime-teaching-resource-binding`: "Lesson and step inventory feeds the restage" 改为 step 按 `sequence.json` 节点绑定、课次入口不入清单；新增"多知识点资源必须携带锚点"要求。
- `versioned-knowledge-consumer-activation`: "Consumer readiness is explicit and independent" 与 "Activation stages complete immutable materialization" 增加绑定发布身份与媒体 sha256 校验。
- `adaptive-learning-path-planning`: "Planner gates active path nodes by learner readiness" 增加首次/复现资源按掌握度准入；"Path generation snapshots the live published resource index" 改为快照绑定发布身份。
- `graph-path-experience`: "Learning paths consume bound resources in prerequisite order" 增加锚点导航与首次优先要求。

## Impact

- 新模块 `src/lib/resource-binding-release/`；新 CLI `resource-bindings:check|write|qualify`；`scripts/knowledge/restage-runtime-teaching-bindings.ts` 的绑定部分退役。
- 消费者：`src/lib/authority-domain-shards/resource-bindings.ts`、`src/features/personalization/path-planning/planning-projection-index.ts` 与 `internal/knowledge-path-mount.ts`、`knowledge-path-assembly.ts`、`src/lib/published-resource-index.ts`、`src/lib/layered-graph/resolver.ts`、`teaching-resource-launch-maps.ts`、`src/lib/full-resource-path-readiness-gate.ts`、`src/lib/versioned-knowledge-activation/{contracts,stage,readiness}.ts`、`src/lib/teaching-projection/live-course-pointer.ts`。
- UI：`active-authority-graph.tsx`（锚点标签、首次/复现）、`lesson-entry-media-hub.tsx`（`media/t` 定位）、`handout-print` 页面（标题锚点）。
- 内容：`course-content/authoring/knowledge/resource-bindings/`（crosswalk、anchors）、`course-content/scripts/export_runtime.py`（转录导出）、`course-content/runtime/lessons/<unit>/media/*.transcript.json`、`course-content/runtime/knowledge/resource-bindings/`。
- 数据：不改 Prisma schema；新增本地 seed 脚本写入测试学习者 `AdaptiveMasteryUpdate`。
- 不修改 ActKG Authority、overlay A、生产选择器；不做生产 `runtime:publish` / `runtime:activate` / `deploy:*`。
