## ADDED Requirements

### Requirement: Binding release identity derives from the Authority release
资源绑定发布 MUST 作为独立运行态工件族存在于 `course-content/runtime/knowledge/resource-bindings/`，包含 `current.json` 与 `releases/<bindingReleaseId>/`。`bindingReleaseId` MUST 为 `<authorityReleaseId>-b<n>`，其中 `n` 为同一 Authority release 上按顺序递增的绑定重建序号；`bindingHash` MUST 为 manifest body 的 canonical JSON SHA-256。manifest MUST 记录 Authority release/snapshot/hash、prerequisite publication 身份、全部来源摘要与被绑定媒体的 sha256 集合。绑定发布 MUST NOT 依赖课程投影 B′ 的 `bindings.jsonl`。

#### Scenario: First release on an Authority
- **WHEN** 在 `control-theory-engineering-v0.37-r6` 上首次构建绑定发布且没有既有 release
- **THEN** `bindingReleaseId` SHALL 为 `control-theory-engineering-v0.37-r6-b1`
- **AND** manifest SHALL 记录 `bindingHash` 与 Authority 身份

#### Scenario: Rebuild on the same Authority
- **WHEN** 同一 Authority 上已有 `-b1` 且来源发生变化后再次构建
- **THEN** 新 release SHALL 为 `-b2`，`-b1` 目录 SHALL 保持不可变

#### Scenario: Authority identity mismatch
- **WHEN** 输入来源中的 Authority snapshot 与当前 authority `current.json` 不一致
- **THEN** 构建 SHALL 失败关闭并且不写入任何 release 目录

### Requirement: Multi-knowledge resources bind through precise anchors
每条绑定 MUST 携带 `anchor`，`anchor.kind ∈ {step, heading, time, section, whole}`。`handout`、`audio`、`video`、`podcast`、`textbook`、`textbook-chapter` 类型的资源 MUST 使用 `heading`、`time` 或 `section` 锚点；`whole` 只允许单知识点资源（card、infographic、simulation、exercise）。`time` 锚点 MUST 包含 `mediaId`、`runtimePath`、`mediaSha256`、`startSeconds`、`endSeconds`。全书级 `act:textbook:<book>` 与课次入口 `act:lesson:<unit>` MUST NOT 出现在资源清单中。锚点与绑定 MUST NOT 存储任何投递 URL。

#### Scenario: Audio segment binds a node
- **WHEN** 课次音频某语义段的术语重叠命中一个已映射 canonical 节点
- **THEN** 绑定 SHALL 使用 `time` 锚点并记录 `startSeconds/endSeconds/mediaSha256`

#### Scenario: Handout without anchors
- **WHEN** 某课次讲义没有任何章节锚点命中节点
- **THEN** 该讲义 SHALL NOT 产生节点级绑定，并在 gate 报告中列为 `no-anchor`

#### Scenario: Lesson entry is presented as a resource
- **WHEN** 来源清单包含 `act:lesson:<unit>` 或全书级 `act:textbook:<book>`
- **THEN** 构建 SHALL 将其排除且 gate SHALL 在 findings 中记录 `entry-excluded`

### Requirement: Bindings carry first-appearance semantics from the teaching order
每条绑定 MUST 标注 `appearance ∈ {first, revisit, reference}`。带课次的资源（step、讲义章节、课次音视频）MUST 携带 `teachingOrder{unitId, unitIndex, stepIndex}`：对每个 canonical 节点，按课程单元顺序最早出现绑定的课次 MUST 为 `first`，其后课次 MUST 为 `revisit`；课次 `focus_node_ids` 命中 MUST 记入 `focus=true`。无课次位置的参考资料（知识卡、信息图、教材小节、仿真）MUST 为 `reference` 且 `teachingOrder` 为空，任何掌握度下均可准入。教学顺序 MUST 来自课程顺序真源，MUST NOT 从既有绑定反推。

#### Scenario: Node appears in three units
- **WHEN** canonical 节点在 1-1、2-1、5-3 三个课次都有绑定
- **THEN** 1-1 的绑定 SHALL 为 `first`，2-1 与 5-3 SHALL 为 `revisit`

#### Scenario: Steps inside one unit
- **WHEN** 同一课次多个 step 绑定同一节点
- **THEN** 这些绑定 SHALL 共享 `appearance` 并按 step 顺序记录 `stepIndex`

#### Scenario: Reference material
- **WHEN** 一张知识卡或一个教材小节绑定某节点
- **THEN** 该绑定 SHALL 为 `reference` 且不携带 `teachingOrder`

### Requirement: Course nodes map to canonical identity only through an explicit crosswalk
课程节点（`名称_章_序号`）到 canonical ID 的映射 MUST 来自作者态 `course-node-crosswalk.jsonl`，每行为一对一映射或显式 `unmapped`。构建 MUST NOT 用模糊匹配或向量相似度产生映射。`unmapped` 节点 SHALL NOT 产出绑定，并 MUST 在 gate 报告中列出。锚点级候选节点 MAY 由 Authority 已发布标签（canonical_preferred / alias / 作者态显式别名表）在锚点文本中的逐字出现产生，匹配 MUST 限定在课次知识范围内或仅接受足够特异的长标签，同一标签对应多个同类实体且均不在范围内时 MUST 视为歧义并跳过；每条此类绑定 MUST 记录 `provenance.method` 与 `matchedLabel`。

#### Scenario: Label occurs verbatim in a segment
- **WHEN** 课次范围内某节点的 canonical_preferred 标签逐字出现在一个音频语义段中
- **THEN** 构建 SHALL 产出该段到该节点的绑定并记录 `asr-terminology` 与匹配标签

#### Scenario: Label is ambiguous
- **WHEN** 一个标签对应多个不在课次范围内的同类 Authority 实体
- **THEN** 构建 SHALL 跳过该标签并在 `anchors-summary.json` 的 `ambiguousLabels` 中记录

#### Scenario: Node resolves through crosswalk
- **WHEN** step 的 `node_ids` 中某课程节点在 crosswalk 中有唯一 canonical ID
- **THEN** 构建 SHALL 产出到该 canonical 的绑定

#### Scenario: Node is unmapped
- **WHEN** 课程节点在 crosswalk 中标记为 `unmapped`
- **THEN** 构建 SHALL 跳过该节点并在 `gate.json` 的 `unmappedCourseNodes` 中记录

### Requirement: Binding gate fails closed and audits fan-out
构建 MUST 生成 `gate.json` 与 `audit-report.json`。gate MUST 在以下情况阻断：课次入口或全书级资源进入清单、多知识点资源以 `whole` 锚点绑定、Authority 身份不一致、已产出的 `time` 锚点其 `mediaSha256` 与激活运行态清单不一致或媒体不在清单中、锚点越界（`startSeconds ≥ endSeconds` 或超出媒体时长）、绑定为空。本地媒体与激活运行态对象不一致时，该媒体 MUST 在构建前被排除时间锚点并以 `media-drift` 警告记录，而不是让整个发布失败。audit MUST 报告每节点绑定数分布、每资源扇出、角色分布、provenance 分布、appearance 分布，并与前一绑定发布或旧 B′ 对比。

#### Scenario: Local media differs from the active release
- **WHEN** 某课次导入视频的本地字节与激活运行态清单中同路径对象不一致
- **THEN** 该媒体 SHALL 不产出 `time` 锚点，gate SHALL 记录 `media-drift` 警告，发布仍可通过

#### Scenario: Bound anchor drifts
- **WHEN** 已产出的 `time` 锚点其 `mediaSha256` 与激活运行态清单不一致
- **THEN** gate SHALL 为 `failed` 且 `current.json` SHALL 不更新

#### Scenario: Audit is produced
- **WHEN** 构建成功
- **THEN** `audit-report.json` SHALL 含 `perNodeBindingCount` 分位数、`topFanoutResources`、`roleCounts`、`provenanceCounts` 与对比基线身份

### Requirement: Transcripts are runtime companions bound to media identity
课次音频、导入视频与课程视频的转录 MUST 导出为 `runtime/lessons/<unit>/media/<unit>-<kind>.transcript.json`（contract `act-media-transcript/v1`），包含源 `runtimePath`、媒体 `sha256`、`durationSeconds`、`processorIdentity`、全文以及逐字时间戳或 cue。导入视频转录 MUST 以 Videos 项目设计文稿 cue 为真源并记录片头偏移；课程视频转录 MUST 记录本机模型处理器身份。转录 MUST NOT 进入路径规划资源池或 RAG 语料。

#### Scenario: Transcript accompanies media in a runtime release
- **WHEN** 运行态发布包含 `lessons/3-8/media/3-8-audio.m4a`
- **THEN** 同目录 SHALL 包含 `3-8-audio.transcript.json` 且其 `sha256` 等于该音频对象的 sha256

#### Scenario: Intro video offset cannot be verified
- **WHEN** 某单元 `narrationDurationSeconds + intro + outro` 与 mp4 实际时长偏差超过容差
- **THEN** 该视频 SHALL 只保留 `offset-unverified` 标记且不产出 `time` 锚点

### Requirement: Anchored launch targets navigate to the exact position
资源在抽屉或路径节点上呈现时 MUST 携带锚点标签（步骤序号、讲义章节、媒体时间段、教材小节）与 `appearance` 标记。启动地址 MUST 为应用路由加定位参数：step → `?step=<stepId>`；讲义 → `handout-print#<headingId>`；音视频 → 课次入口路由加 `?media=<mediaId>&t=<startSeconds>`；教材 → 小节路径。页面 MUST 在媒体元数据加载后定位到 `t`；当绑定 `mediaSha256` 与当前激活清单不一致时 MUST 降级为整段播放并提示定位待更新，MUST NOT 静默错位。

#### Scenario: Learner opens an audio binding from the drawer
- **WHEN** 学习者点击抽屉中锚点为 `12:35–13:10` 的音频资源
- **THEN** 课次入口页 SHALL 打开对应音频槽位并将播放位置设为 755 秒

#### Scenario: Handout heading deep link
- **WHEN** 学习者打开锚点为 `h5-2-3` 的讲义资源
- **THEN** `handout-print` SHALL 滚动到该标题且标题元素具有稳定 `id`

#### Scenario: Media was re-iterated
- **WHEN** 绑定的 `mediaSha256` 与激活运行态清单不一致
- **THEN** 页面 SHALL 从头播放并显示定位待更新提示
