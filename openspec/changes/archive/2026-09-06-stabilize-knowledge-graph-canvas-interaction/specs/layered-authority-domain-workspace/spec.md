## MODIFIED Requirements

### Requirement: Cross-domain relations use explicit boundary navigation
A published relation whose adjacent object belongs outside the active domain SHALL be represented by a persistent accessible boundary cue on the real source node until the user explicitly follows it. The cue SHALL use an animated halo independent of edge-family visibility; the node drawer SHALL list the human-readable target domain, real adjacent node, and relation meaning. Following the entrance SHALL enter a reviewed target domain before selecting the real adjacent object. 对实际存在的跨领域关系，2D 画布 SHALL 直接渲染其拓扑：目标领域以带名称的虚线圆呈现，跨领域概念作为该圆内的节点按领域聚类，并与域内端点绘制真实关系边；顶部横幅式「跨领域入口」列表 SHALL 被移除，不再占用画布上方主画面。点击画布内跨领域节点 SHALL 等价于跟随该边界进入对应领域。

#### Scenario: Cross-domain edge visibility is disabled
- **WHEN** the user disables the relation family that contains a current accessible cross-domain relation
- **THEN** the edge geometry MAY become hidden while the source node's verified boundary halo and drawer entrance remain available
- **AND** the cue SHALL NOT disclose a target outside the current user's authorization

#### Scenario: User follows a cross-domain neighbor
- **WHEN** the user activates an eligible boundary entrance from the node drawer or clicks a cross-domain cluster node on the 2D canvas
- **THEN** the workspace SHALL show the target domain name and relation meaning, load the target domain, and focus the real adjacent object
- **AND** it SHALL not load the target domain's full content, create a proxy node, or treat the root domain circle as the adjacent object

#### Scenario: Cross-domain relations render on the canvas
- **WHEN** the active domain has accessible relations whose adjacent objects belong to one or more reviewed target domains
- **THEN** the 2D canvas SHALL render each involved target domain as one labeled dashed circle containing its cross-domain concept nodes, with real edges connecting in-domain endpoints to those nodes
- **AND** no banner list above the canvas SHALL duplicate these entries
