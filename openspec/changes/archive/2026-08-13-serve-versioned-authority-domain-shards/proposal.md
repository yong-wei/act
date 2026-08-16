## Why

当前 active Authority 页面虽然限制同时绘制的节点数量，但浏览器仍先下载并解析完整图谱。要让领域层级真正提高首屏与交互效率，需要服务端提供按版本和领域拆分的渐进数据合同。

## What Changes

- 提供根目录、领域默认教学骨架、工程关系族、节点一跳邻域和节点详情/媒体的独立分片。
- 以 Authority 选择、领域目录版本、Teaching Projection 版本和关系族组成缓存身份，版本变化时拒绝混用旧分片。
- 首屏只返回领域摘要；进入领域后只加载默认教学关系与必要端点，其他工程关系族按用户选择加载。
- 教学投影部分覆盖或缺失时仍返回可用的工程领域分片，并携带人类可解释的覆盖状态。
- 将完整图谱接口限制在授权诊断路径，普通用户交互不得隐式触发全量加载。

## Capabilities

### New Capabilities
- `authority-domain-shard-delivery`: 定义 Authority 领域图谱的版本化分片、缓存、合并和非阻断降级合同。

### Modified Capabilities
- `active-authority-semantic-graph-presentation`: 将有界可见子图从客户端截断升级为服务端渐进交付。
- `resource-node-knowledge-workspace-ui`: 让根级、领域、关系族和详情请求遵循同一版本身份并复用已加载对象。

## Impact

影响知识图谱 API、服务端投影器、缓存键、客户端数据仓库与性能测试；不改变 Authority 或 Teaching Projection 的事实内容。
