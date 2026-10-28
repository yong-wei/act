## Why

新版知识图谱（`/knowledge`，active Authority 2D 工作台）在 1440×900 下存在多处与既有规范不符的呈现缺陷：根视图是一圈等大的圆点（规范要求紧凑不规则气泡簇、名称在气泡内），领域视图标签互相压叠，选中后邻居标签绕过避让，右侧 inspector 遮住右上工具栏，图例条在浅色主题下用 sky/red-200 等原始色不可读，缺失的关系族显示为红色失败。同时新版图谱节点没有任何掌握度信息，学生无法从图上看到自己的学习进度。

## What Changes

- 根视图改为按知识点数量定尺寸的紧凑气泡簇（复用既有确定性 packing），全名在气泡内最多 3 行，采用与仿真 HUD 一致的“仪表盘”分层质感，颜色由平台 token 派生并在深浅主题均可读。
- 领域视图布局的碰撞半径纳入外部标签尺寸；选中节点后的邻居标签参与避让，不再无条件绘制。
- 画布节点、关系与标签颜色改为随主题切换的 token 调色板，移除硬编码十六进制。
- inspector 浮层从工具栏下方开始布局，工具栏、返回与关闭控件始终可达、互不遮挡；关系行文案收敛为“方向 · 关系 · 对端名称”。
- 图例条改用平台 token；关系族分片“确实不存在”时显示中性说明“本领域暂无该类关系”，只有真正的加载失败才显示错误与重试。
- 新增服务端拥有的新版图谱学习者掌握度叠加：仅向已登录学生返回本人数据；只读取带新版身份的学习事实，以及经审核、已发布到运行态的旧→新对照表；不回填、不改写历史事实。当前数据为空时如实显示“暂无掌握度数据”。根气泡与领域节点在有数据时编码掌握状态。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `resource-node-knowledge-workspace-ui`: 新增工作台“仪表盘”主题画布、inspector 与工具栏避让、关系族缺失与失败分离的要求。
- `active-authority-semantic-graph-presentation`: 新增选中邻居标签避让与领域布局标签感知间距的要求。
- `learner-graph-overlays`: 新增新版 Authority 图谱的本人掌握度叠加要求（身份来源、角色边界、空态）。

## Impact

- 前端：`src/features/knowledge/knowledge-graph-workspace.tsx`、`active-authority-graph.tsx`、`active-authority-filter-panel.tsx`、`graph/active-renderer/*`（geometry、visual、label-geometry、2D renderer）。
- 服务端：新增 `GET /api/knowledge/shards/active/mastery` 与纯函数聚合模块；读取 `LearningFact`（只读）与运行态 Teaching Projection 根下的 `legacy-crosswalk.jsonl`（缺失即空）。
- 测试：`src/features/knowledge/__tests__` 中根布局、标签、inspector、关系族控件契约需要更新，新增掌握度聚合与路由测试。
- 无数据库迁移、无 runtime 发布或激活、无部署。
