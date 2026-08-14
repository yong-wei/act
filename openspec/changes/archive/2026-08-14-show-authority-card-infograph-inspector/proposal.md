## Why

领域知识对象已经具备知识卡和信息图，但 active Authority 工作区尚未把它们作为节点详情的主要学习入口。需要复用旧图谱侧边栏的阅读模式，让用户从图中选择节点后直接理解概念、查看知识卡和信息图。

## What Changes

- 点击或键盘选择领域知识节点后，在响应式侧边栏/移动面板中显示人类可读名称、类型、摘要和关系概览。
- 仅在同一 Authority shard envelope 明确绑定并通过校验的 Teaching Projection 下按需加载该节点的知识卡与已接受信息图；可选内容不存在、未授权或不可用时整段隐藏。
- 将知识卡正文与信息图媒体放在节点详情分片中按需加载，不进入根级或领域首屏载荷。
- 缺卡、卡受阻、信息图缺失或媒体加载失败时保持语义详情可用，但不渲染缺失/草稿/不可用的媒体占位，不泄露路径、对象标识、哈希或内部状态。
- 保持旧图谱的打开、关闭、焦点进入与返回、邻接节点跳转和移动端可达性合同。

## Capabilities

### New Capabilities
- `authority-card-infograph-inspector`: 定义 active Authority 节点侧边栏、知识卡与信息图的授权、审核和渐进加载行为。

### Modified Capabilities
- `active-authority-semantic-graph-presentation`: 将节点详情扩展为知识卡和信息图学习面板，同时保持禁止系统字符串的边界。
- `resource-node-knowledge-workspace-ui`: 统一节点选择、资源详情、媒体状态与响应式焦点合同。

## Impact

影响节点详情 API、知识卡/信息图导出消费、侧边栏组件、授权与媒体错误态、可访问性和产品 QA；不改变卡片审核状态或 Authority 实体关系。
