---
status: accepted
context: formal-runtime-canonical-resource-binding
supersedes_in_part: docs/grill/20260727-pm/adr/20260727-build-resource-bindings-with-node-led-bidirectional-deltas.md
---

# 以原子 Canonical 绑定作为正式运行态资源发布闸门

## 背景

当前通用 Teaching Projection 有 567 条旧绑定，但只覆盖 lesson、step 和少量 textbook-section，与 active Authority 身份不一致，也没有视频、音频、播客、习题和知识卡资源行。当前 active shard 没有 Teaching Projection identity，节点详情因此把全部系统资源失败关闭为 unavailable。

现有本地 runtime 同时承载开发候选与发布输入，没有一份把候选、纳入、排除和 Canonical 绑定冻结在同一身份中的正式分母。媒体没有实际语义分段脚本和时间定位工件；文本段落身份不完整；旧 canonical binding 规范还允许 normalized label/alias 直接产生 `BOUND`。这些事实不能支持“所有正式教学资源均有可定位绑定”的发布声明。

## 决策

所有准备进入正式 Runtime Release 的教学资源必须取得原子级 Canonical 绑定；未通过资源可以保留在开发 runtime，但必须从正式 manifest 排除。不要求每个 Canonical Object 都具有资源。非教学片段只有取得显式分类和审核处置后才可豁免，不能用缺失绑定或旧 `NONE` 状态代替豁免。

视频、音频、播客以及教材、知识卡、讲义等文本均以稳定语义段落为最小绑定单位，习题以稳定题目为原子单位。每个原子必须取得“已绑定”或“经审核的非教学片段”处置；每份正式教学资源至少具有一个已绑定片段。媒体段落保存经校验的 `startSeconds`，结束位置由下一段起始时间或媒体总时长按版本化规则推导。intro-video 优先使用制作方台词本和设计真源并核对最终媒体；course 视频和播客通过 ASR、语义分段和时间对齐生成脚本。

资源管道不要求逐资源人工审核。ASR、语义分段、时间对齐和 Canonical 映射分别以代表性 gold/holdout 建立并冻结版本资格，采用精确率与召回率平衡指标；单项低置信、身份漂移、证据不足或结构错误仍失败关闭。失败资源留在开发 runtime，候选处置记录保留其原因，其他合格资源可以继续发布。

正式分母复用并扩展内容寻址 Runtime Release v2，不建立第二发布权威。receipt 同时绑定候选资源清单 hash、正式纳入清单 hash、排除处置清单 hash、Canonical 绑定集 hash、Authority 身份、runtime/tree hash、捕获 Git 修订和发布证据。normalized label、alias、向量或模型结果只能生成候选，不能在没有完整原子证据与门禁时直接成为正式 `BOUND`。

Canonical 绑定继续使用 `COVERS`、`EXPLAINS`、`PRACTICES`、`ASSESSES` 四类教学角色；视频、音频、播客、卡片、习题等通过精确 `resourceType` 表达。运行态节点内部按视觉类型族聚合标识，抽屉保留全部精确子类型和资源。抽屉复用既有播放器、阅读器和题目运行态按原子锚点启动；无法生成安全 launch target 或无法消费锚点的资源不得进入正式发布。

媒体 hash 变化使整份媒体脚本、分段、定位和绑定失效；文本仅保留稳定 ID 与内容 hash 均未变化的段落绑定；题干、选项、答案或解析变化使该题绑定失效。绑定只表达内容语义，不因播放、阅读或绑定存在自动产生掌握事实。

## 结果

- 现有 567 条旧绑定只能作为候选或迁移输入，不能证明当前 Authority 或完整正式资源覆盖。
- Teaching Projection、canonical binding、ResourceNode 和 Runtime Release v2 需要共同扩展原子身份、资源类型、处置、hash 与失败关闭合同，但生产选择仍由既有 Runtime Release v2 保持唯一权威。
- 正式资源标识只来自当前 Authority、Runtime Release、绑定修订和用户访问资格均一致的资源；开发或失败资源只存在于仓库审核工件和不部署的开发工具。
- 外部签名 URL、令牌、脚本全文、私有来源载荷和个人数据不得进入公开绑定证据、学习事件或静态审核工件。

## 未采用方案

- 只接通现有 567 条绑定：类型、身份和覆盖范围均不完整。
- 每个资源只要有一条宽泛绑定即可发布：无法证明其余教学段落已经处置。
- 每句台词建立独立关系：产生大量无意义边并增加不稳定时间码维护成本。
- 在图谱抽屉内重造媒体与文本运行时：重复现有渲染器并形成第二套锚点解释。
