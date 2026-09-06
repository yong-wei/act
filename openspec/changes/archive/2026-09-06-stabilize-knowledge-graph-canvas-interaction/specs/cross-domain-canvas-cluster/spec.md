## ADDED Requirements

### Requirement: Cross-domain cluster circles on the 2D canvas
新版 2D 领域画布 SHALL 把当前领域实际存在的跨领域关系渲染为画布内拓扑：每个被引用的目标领域呈现为一个更大的虚线圆，圆上标注领域名称；该领域的跨领域概念作为节点置于圆内，同一目标领域的多个概念 SHALL 聚类在同一个圆内；域内端点与跨领域节点之间 SHALL 绘制带既有族样式的真实关系边。

#### Scenario: Multiple concepts share one target domain
- **WHEN** 当前领域有多个跨领域关系指向同一目标领域
- **THEN** 这些跨领域概念节点 SHALL 位于同一个虚线领域圆内
- **AND** 画布上 SHALL 只为该目标领域渲染一个圆

#### Scenario: Cluster circles stay clear of the domain overview
- **WHEN** 跨领域圆与概览节点同屏呈现
- **THEN** 领域圆 SHALL 锚定在有界概览的外圈边界，不参与力导向漂移
- **AND** 沉降冻结与显式重新布局对跨领域节点与领域圆同样生效

#### Scenario: Cross-domain node interaction
- **WHEN** 用户点击圆内的跨领域概念节点
- **THEN** 工作区 SHALL 进入该节点所属的目标领域并选中该真实对象
- **AND** hover 时 SHALL 复用既有有界预览浮层呈现其名称、类型与摘要
- **AND** 超长名称 SHALL 走与域内节点一致的画布截断规则

#### Scenario: No cross-domain relations
- **WHEN** 当前过滤组合下不存在可访问的跨领域关系
- **THEN** 画布 SHALL NOT 渲染任何虚线领域圆或跨领域节点
- **AND** 画布上方 SHALL NOT 出现横幅式跨领域入口列表

### Requirement: Cross-domain canvas rendering is 2D-only in this contract
跨领域虚线圆渲染 SHALL 只覆盖新版 2D 画布；3D 视图与旧版图谱 MAY 保持既有行为，本合同不要求在 3D 中渲染领域圆。

#### Scenario: 3D view unchanged
- **WHEN** 用户切换到 3D 视图
- **THEN** 跨领域导航 SHALL 继续通过既有节点抽屉与目录通道可用
- **AND** 3D 画布 SHALL NOT 渲染虚线领域圆
