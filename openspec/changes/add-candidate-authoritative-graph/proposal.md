## Why

当前图谱 UI 只能表达旧式三类节点和关系，无法验证 ActKG 异质对象、精确谓词和治理信息。根轨迹局部 Release 应尽早形成公开候选视图，同时与正式生产权威严格隔离。

## What Changes

- 新增独立 V2 画布和详情 API，消费 `act.canvas.v2` 与 `act.node-detail.v2`，不在客户端拼接新旧数据。
- 迁移期实现显式旧版/新版切换，但普通用户公开激活和默认新版必须等待候选控灵变更完成并通过只读验收。
- 将 DomainConcept、Formula、KnowledgeStatement、SystemModel 等正式对象作为一等节点，按 `canonical_type` 顶级导航并保留一跳异质邻居。
- 精确显示上游谓词及方向，并为当前六种谓词建立稳定中文登记；Gold 渲染为“核心”，Silver 渲染为“扩展”，默认显示核心加扩展。
- 学生、教师和管理员使用分层详情投影；未知但当前 Schema 合法的类型使用通用只读样式。
- 明确标注“根轨迹局部发布版”、真实覆盖范围和教学关系尚未发布。
- 本变更依赖 `add-authoritative-knowledge-repository`，不改变 RAG、SAR、路径、资源或学习事实的生产权威。

## Capabilities

### New Capabilities

- `candidate-authoritative-knowledge-graph`: 定义 ActKG 候选图谱的版本化 API、导航、视觉、详情和覆盖提示。

### Modified Capabilities

- `knowledge-graph-projection-contract`: 增加与旧投影隔离的 V2 候选投影消费合同。
- `resource-node-knowledge-workspace-ui`: 增加迁移期候选/旧版显式切换及默认候选体验。

## Impact

- 影响知识图谱 API、画布、详情面板、筛选图例、角色投影和 UI 测试。
- 旧图 API 在迁移期保持原样；正式退役由最终切换变更负责。
