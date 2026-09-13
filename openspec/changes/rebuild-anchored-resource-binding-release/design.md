## Context

- Authority：`control-theory-engineering-v0.37-r6` / `snap-0253d66d…`。overlay A `proj-0260a81c…`，课程 B′ `proj-228afa64…`（4,117 资源 / 21,633 绑定 / 571 前置 / 466 核心节点），consumer-activation `activation-de00f069…`。
- 绑定生成链：`scripts/knowledge/restage-runtime-teaching-bindings.ts` → `planRuntimeFullBinding()`（`src/lib/teaching-projection/runtime-full-binding.ts`）。课次、step、讲义、音频、视频、习题、课次仿真全部经 `bindToUnit()` 绑定到该课次全部 canonical 节点；step 的 `knowledgeRefs` 在 restage 转换时被丢弃。运行态 `interactive-manifest.json` 的 step 也没有 `knowledgeRefs`。
- 教学顺序真源：`course-order/topics.jsonl`（143 topic → 193 canonical，含有序 `units`）、`course-order/units.jsonl`（31 单元）、课次 `manifest.json`（`focus_node_ids` 225 项 / `reuse_node_ids` 211 项 / `preceding_lesson`）、`cards/lessons/<unit>/sequence.json`（`groups[].step_ids ↔ node_ids`）。课程节点（`canonical-nodes.json` 220 项）与 ctkg canonical 之间没有完整 crosswalk。
- 已有转录：`formal-resource-remediation/20260823-asr-batch/`（28 课音频：transcript、逐字 `{w,s,e}`、8–25 s 语义段及术语重叠节点候选）；Videos 项目 `src/projects/lesson-<unit>/assets/audio/captions.generated.ts` + `captions.ts`（`INTRO_FRAMES=300`、`OUTRO_FRAMES=360`、30 fps）为 31 课导入视频文稿真源；28 课 NotebookLM `*-course.mp4` 无转录。
- 已激活运行态 `runtime-6ed6cfe8…`：31 个 `intro-video.mp4` 为 Videos 渲染件（19 个为再渲染，本机无留存），28 个 `course.mp4` 与本机字节一致。
- 投递：`projectRuntimeMediaResources()` 把媒体 URL 统一改写为 `/api/course-runtime/assets/lessons/<unit>/media/<file>`；生产 307 到签名 OSS URL，开发机走激活网关按 pin 校验 sha256 后 Range/206 流式返回；未来切 ESA 只改 307 目标。页面用原生 `<video>/<audio>`。
- 深链：step 已支持 `student/demo?step=<stepId>`；教材已支持路径级小节 + `#formula-/figure-/table-` hash；`handout-print` 无标题锚点；音视频页面不读起播参数。
- 路径规划：目标切片链路 `assembleKnowledgePathPlan()` 不读掌握度、不读 bindingRole，`lesson` 与 `step` 同映射为 `lesson_step`；掌握度来自 `AdaptiveMasteryUpdate`（BKT，`posteriorMastery`/`confidence`），通用 planner 已有 `≥0.85 且 confidence≥0.6` 的已掌握阈值。
- 已有规范：`formal-runtime-atomic-resource-binding`、`resource-segment-scene-binding`、`canonical-knowledge-resource-binding` 已定义锚点/原子语义；`src/lib/resource-node-registry.ts` 已有 `ResourceSegmentAnchor{kind, ref, startSeconds, endSeconds, page}`。

## Goals / Non-Goals

**Goals:**
- 绑定成为独立、按图谱版本编号、可单独重建与激活的运行态工件族。
- 每条绑定精确到 step / 讲义章节 / 媒体时间段 / 教材小节，并标注首次出现或复现。
- 抽屉与路径资源节点携带锚点导航，点击直达位置；课次入口不再作为资源。
- 路径规划按掌握度决定首次/复现资源准入。
- 转录随运行态发布并与媒体 sha256 绑定，防止再次丢失。

**Non-Goals:**
- 不修改 ActKG Authority、overlay A、prerequisite publication、生产选择器；不做生产发布或部署。
- 不为 MPC / 数据驱动 / RL 等 Authority 缺口伪造 canonical 映射。
- 转录不进入 RAG、路径资源池或学生可见搜索。
- 不重做 Konling 的路径解释与候选批次结构，只替换其资源候选来源与准入过滤。

## Decisions

1. **独立工件族，而非重建 B′**。`resource-bindings/releases/<id>/` 持有 `binding-manifest.json`、`resources.jsonl`、`bindings.jsonl`、`gate.json`、`audit-report.json`。B′ 继续承载 prerequisites/coreNodes/cards。理由：绑定的变更频率（内容锚点、媒体再迭代）远高于前置关系，捆绑重发会不断制造新的 B′ 身份；用户明确要求不再沿 B′ 路线扩展。替代方案"B′ 内加字段并改 ID 格式"被否决。
2. **身份派生**。`bindingReleaseId = <authorityReleaseId>-b<n>`，`n` 由构建器扫描同 Authority 下既有 release 递增；`bindingHash` 为 canonical JSON SHA-256（复用 `projectionDigest`）。manifest 记录 Authority release/snapshot/hash、prerequisite publication id、来源摘要（lessons inventory、anchors、crosswalk、course-order、textbook mapping、transcripts）、激活运行态 releaseId 与媒体 sha256 集合。
3. **锚点契约复用 `ResourceSegmentAnchor` 语义**：`anchor.kind ∈ {step, heading, time, section, whole}`；`step` 带 `stepId`；`heading` 带 `headingId` 与标题文本；`time` 带 `mediaId`、`runtimePath`、`mediaSha256`、`startSeconds`、`endSeconds`；`section` 带教材 `sectionPath`；`whole` 仅允许单知识点资源（card、infographic、simulation、exercise）。多知识点类型（handout、audio、video、podcast、textbook、textbook-chapter）出现 `whole` 即门禁失败。
4. **绑定规则**：step → `sequence.json` 所在 group 的 `node_ids`（经 crosswalk）加 step 文本术语命中；handout → 章节；audio/video → 语义段/cue；textbook → 仅 `textbook-section`/`textbook-chapter`；`act:lesson:*` 与全书级 `act:textbook:*` 不产出。card/infographic/simulation/textbook-section 这些精确通道在 b1 直接从当前课程投影 B′ 的 `bindings.jsonl` 按类型过滤后携带（`provenance.method = carry-forward-exact`，manifest 记录 `carryForwardProjectionId/Hash`），不重新实现 card crosswalk / 信息图文件名 / 仿真声明 / 教材 locator 通道；B′ 在这些通道上仍是作者态决策的物化结果，后续版本可把该输入替换为直接读取作者态来源而不改变绑定契约。exercise（`act:exercise:<unit>`）在旧 B′ 中按课次喷涂且无 step 锚点，b1 不携带，进入 `no-anchor` 残余。课程节点 → canonical 经新 crosswalk，`unmapped` 节点不产出绑定并进入 gate 报告；锚点级候选另按 Authority 标签逐字出现（课次范围内长度 ≥ 2，范围外 ≥ 4 字）产生，歧义标签跳过。
5. **首次/复现**：对每个 canonical，按 `units.jsonl` 顺序取最早出现绑定的课次为 `first`，其后为 `revisit`；同一课次内 step 顺序决定 `stepIndex`。`focus_node_ids` 命中记入 `focus=true`。选择"最早课次"而非 `focus` 判定，是因为 `focus/reuse` 是课次作者视角，跨课一致性不足；`focus` 只作辅助标签。
6. **锚点生产与 provenance**：讲义章节由 `##/###` 标题生成 `headingId = h<n>-<slug>`（序号保证稳定），章节 ↔ 节点由标题与正文术语匹配（label 权重 2、description 权重 1，命中 ≥ 2）预填；音频直接转换既有语义段的 `nodeBindings`；导入视频 cue 按 `INTRO_FRAMES/FPS` 偏移换算并用 `narrationDuration + intro + outro ≈ ffprobe` 校验；课程视频由本机模型转录后走同一术语重叠法。`provenance ∈ {asr-terminology, caption-terminology, heading-terminology, reviewed}`；`review/<unit>.jsonl` 可 accept/reject/override 单条锚点。首版接受非 reviewed 锚点，但 manifest 统计 provenance 分布，抽屉与路径不区分展示。
7. **转录运行态化**：`export_runtime.py` 写 `runtime/lessons/<unit>/media/<unit>-{audio,intro-video,course}.transcript.json`（contract `act-media-transcript/v1`：source runtimePath、sha256、durationSeconds、text、words 或 cues、segments）。绑定 gate 校验转录 sha256 与激活运行态清单一致。
8. **投递无关的深链**：绑定不含 URL；launch maps 生成应用路由 + 参数（`?media=<mediaId>&t=<s>`、`#<headingId>`、`?step=`）；课次入口页选中媒体槽位并在 `loadedmetadata` 后设 `currentTime`。媒体 sha256 与激活清单不一致时降级为整段播放并提示定位待更新。
9. **激活锁**：`versioned-knowledge-activation` combination 增加 `bindingReleaseId/bindingHash`；`live-course-pointer` 要求 `resource-bindings/current.json` 与 activation 一致；readiness 把绑定发布列为 course-runtime、konling、learning-path、teaching-resource-rag 四个消费者的本地依赖。B′ 的 `bindings.jsonl` 保留在旧 release 目录但不再被读取。
10. **路径准入**：`knowledge-path-mount` 读取 `knowledgeMastery`；`evidenceCount = 0 或 posteriorMastery < 0.5` → 仅 `first`；`≥ 0.5 且 evidenceCount > 0` → `first + revisit`；`≥ 0.85 且 confidence ≥ 0.6` → 跳过该知识点。排序：`first` 优先，其次 `teachingOrder` 距离目标切片最近，再按既有偏好分数。阈值常量集中在 `path-planning/application/mastery-thresholds.ts`。

## Risks / Trade-offs

- [课程节点 crosswalk 覆盖不足，导致 step/讲义绑定稀疏] → 用 `topics.jsonl`、`course-to-authority-map.json`、`crosswalk-v037.json` 三源预填并输出 unmapped 清单；unmapped 不猜测，作为 gate 报告项，允许后续版本 b2 补齐。
- [术语重叠锚点误绑] → provenance 显式、review 账本可覆盖、audit-report 给出每节点绑定数与扇出分布，对比旧 B′。
- [本机 ASR 处理器不可用或效果差] → 先按 `locallm` 技能核实可用模型；转录 contract 记录 processorIdentity，不与音频批次混淆。
- [媒体再迭代使锚点错位] → 锚点携带 sha256，gate 与播放端双重校验，错位时显式降级。
- [消费者切换遗漏] → 用 `rg` 枚举全部 B′ `bindings.jsonl` 读取点并逐一切换，B′ store 的 bindings 读取加弃用告警。
- [intro-video 偏移未逐单元核实] → 时长校验不通过的单元只保留整段绑定并标记 `offset-unverified`，不产出时间段锚点。

## Migration Plan

1. 阶段 1 内容真源与转录 → 阶段 2 本地构建 `…-b1` 并 stage 激活锁 → 阶段 3 消费者切换 → 阶段 4 测试。全部本地，不 publish/activate/deploy。
2. 回滚：删除 `resource-bindings/current.json` 并恢复消费者读取 B′ 的代码路径（保留在同一提交历史中）。生产未受影响。

## Open Questions

- 讲义章节 ↔ 节点的术语匹配阈值是否需要与音频一致（当前同为 ≥ 2）；首版沿用，audit 后调整。
