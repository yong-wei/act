## Why

当前一级页面直接呈现大量异构对象和关系，用户难以形成领域结构与学习顺序。需要重新设计渲染层级和加载顺序，使领域导航、默认教学语义与按需工程关系形成清晰的两级工作区。

## What Changes

- 一级页面仅显示八个领域入口与控制理论综合汇总入口，展示规模与可用教学覆盖摘要。
- 二级领域页面默认显示已发布的先修/后修教学骨架；教学投影为空或部分覆盖时仍可浏览领域工程知识。
- 提供关系过滤：教学顺序、结构组成、推导与表示、应用与分析、关联；默认仅启用教学顺序。
- 将 Formula 与 KnowledgeStatement 作为按需次级对象，不在领域首屏与 DomainConcept、SystemModel 同等铺开。
- 对跨领域关系使用边界入口或摘要提示，只有用户进入或选择后才加载另一领域邻域。
- 延续旧图谱的渐进披露、稳定布局、选中邻域强调和键盘/移动端交互，同时禁止显示系统字符串。

## Capabilities

### New Capabilities
- `layered-authority-domain-workspace`: 定义领域一级导航、领域二级教学骨架、工程关系过滤与渐进披露的产品行为。

### Modified Capabilities
- `active-authority-semantic-graph-presentation`: 将当前 Authority 的默认入口改为领域投影和按需真实对象子图。
- `resource-node-knowledge-workspace-ui`: 更新领域进入、关系族过滤、跨域导航和次级对象披露合同。

## Impact

影响 `/knowledge` 工作区、图布局与交互状态、关系图例、响应式呈现、产品 QA 与无系统字符串治理；依赖领域分片服务，不修改图谱事实。
