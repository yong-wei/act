## Why

学生在受治理教材中阅读公式、图表或正文单元时，当前只能转到通用问答后自行描述位置。现有 `resource-coach` 只携带 `resourceId` 等客户端提示，不能证明控灵读取的正文、会话版本和回答引用来自同一份资源。统一教材阅读器已经具备 runtime v2 单元、内容哈希、源修订和稳定公式/图/表锚点，因此适合作为首个可验证闭环。

## What Changes

- 首个支持页面固定为 unified textbook reader 的一个 runtime v2 结构单元及其可选已登记 fragment anchor。
- 建立服务端资源上下文身份：`resourceId`、`bookId`、`edition`、`sourceRevision`、`unitId`、`contentHash`，精确片段另带 `anchorId`。
- 客户端 URL、可见正文、选区和 offset 只作为提问提示；服务端在每轮请求中重新鉴权并按固定身份读取正文和锚点。
- 会话固定首次验证通过的资源版本。活动内容更新后不得把旧回答静默映射到新版本；旧版本或锚点不可验证时显示版本变化或定位不可用。
- 回答引用只使用服务端水合的版本绑定 `CitationAddress`；点击时必须解析到会话固定的版本、单元和锚点，否则保持当前位置并显示不可用。模型自写 URL、未知引用和跨版本引用不可点击。
- 控灵面板不得重建阅读页。关闭面板时保留 reader 记录的最新有效单元、fragment、滚动位置和焦点；学生在面板打开期间直接阅读或显式跟随引用形成的新位置不得被旧快照覆盖。
- 首个变更不覆盖普通 `TeachingResource`、知识卡、`/knowledge` 图谱上下文、PDF、视频时间轴或外部网页。

## Capabilities

### New Capabilities

- `governed-resource-page-coaching`: 定义受治理资源页入口、版本固定会话、服务端重读、同版本引用、失败关闭和阅读位置保持合同。

### Modified Capabilities

- `konling-agent-runtime`: 使 `resource-coach` 接受并验证 unified textbook reader 的版本绑定上下文，在上下文失效时显式降级而不回退通用资源猜测。

## Impact

- 主要影响 unified textbook reader、全局控灵面板、AI chat route、Konling 服务端上下文解析、会话 metadata 和引用呈现测试。
- 复用 structured textbook runtime、现有教材鉴权、Source Pack/Citation Hydrator、CitationChip 和 fragment focus；不新增正文存储、聊天系统或引用数据库。
- 提案不 claim、不实现，也不改变通用问答、知识图谱节点上下文和其他资源渲染器。
