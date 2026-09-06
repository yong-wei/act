## Why

生产新版知识图谱（/knowledge 领域视图）在 v0.7.4 上存在四类已证实的缺陷，生产实测（demo 账号 + `qa=task-7-4-performance` 快照钩子）与代码证据闭合：

1. **Hover 引发全图漂移**：指针悬停节点后，全部节点持续漂移数秒才重新沉降（相机 zoom 实测不变，但视觉上等同画布缩放）。链路：hover → 父组件 setState → `KnowledgeGraphRuntimeCanvas` 重渲染时每次新建 `materializedNodeIds`（`nodes.map()` 兜底）与默认参数 `expandedNodeIds=[]` / `expandedDirectLinks=[]` / `activationSequenceByCenterId={}` → `KnowledgeGraph2D` 的 `graphData` useMemo 失效重算 → 坐标续承按设计丢弃 fx/fy 沉降冻结 → force-graph 的 graphData setter `forceLayout.stop().alpha(1)` 全量重热。为此设计的 `computeKnowledgeForceStructureSignature`（force-lifecycle.ts）从未接线。
2. **节点标签内容失真**：根轨迹域 85 个节点中 22 个的画布名称是完整定义句（v0.37 上游投影数据质量），多行包裹后视觉混乱；标签上限+视口中心优先策略已实现，但长句标签使碰撞 defer 误伤正常节点。
3. **进入领域多段跳变**：实测进入领域后 16 节点@zoom0.86 → 27 节点@0.91 → 85 节点@0.34 三次跳变（约 3.4s），用户要求进入时布局已排列完成。
4. **跨领域入口横幅语义不明**：过滤族开启后顶部横幅显示「进入系统建模查看 名称暂不可用（属于）」等条目，占据主画面且含义不清。

并案 #2031：图谱 2D 交互层在 headless 捕获环境不响应真实指针（悬停预览与拖拽钉住均无响应），导致产品 QA 无法捕获交互证据；修复本变更的 hover/拖拽行为必须以真实指针证据验收，因此一并调查指针初始化条件。

## What Changes

- **Hover 与引擎解耦（修复漂移）**：`KnowledgeGraphRuntimeCanvas` 内 `resolvedMaterializedNodeIds` 改为 memo 化；`expandedNodeIds` / `expandedDirectLinks` / `activationSequenceByCenterId` 等默认参数改为模块级常量，保证 hover/选择等纯渲染不使 `graphData` memo 失效。接线结构签名护栏：graphData 结构未变时复用上一帧引擎载荷，force 引擎不得在 hover 时重热。
- **标签展示层截断**：长度超过名称预算的标签按子句/词边界智能截断并加省略号，hover 预览与详情抽屉仍显示全称；截断只影响画布标签绘制，不修改任何分片数据或可达名称。
- **进入领域首帧门控**：领域进入后，在数据就绪且力导向沉降完成前显示加载态，就绪后一次性呈现最终排列；消除中间分段跳变。
- **跨领域关系画布内渲染**：取消顶部「跨领域入口」横幅。对实际存在的跨领域关系，在 2D 画布上把目标领域渲染为更大的虚线圆（标注领域名称），跨领域概念作为圆内节点按领域聚类，与域内节点之间绘制真实关系边；点击跨领域节点进入对应领域。仅新版 2D，3D 与旧版保持不变。
- **#2031 指针初始化**：调查并修复 2D 交互层在 headless 捕获环境不响应真实指针的条件，使产品 QA 能捕获悬停预览与拖拽钉住证据。

## Capabilities

### New Capabilities

- `cross-domain-canvas-cluster`: 领域视图内跨领域关系的画布内虚线领域圆聚类渲染与点击进入导航。

### Modified Capabilities

- `active-authority-legacy-force-runtime`：hover/选择等纯渲染不得使 graphData 身份失效；引擎只在结构变化、显式 reflow 或新披露时重热。
- `active-authority-semantic-graph-presentation`：超长标签在画布层按预算截断并保留全称通道；领域进入在沉降完成前不呈现未稳定帧。
- `layered-authority-domain-workspace`：移除顶部跨领域横幅，跨领域入口改由画布内渲染承担。

## Impact

- `src/features/knowledge/graph/knowledge-graph-runtime-canvas.tsx`、`knowledge-graph-2d.tsx`、`viewport-fit.ts`、`node-label-layout.ts`、`force-lifecycle.ts`、`layout-engine.ts`
- `src/features/knowledge/active-authority-graph.tsx`、`active-authority-runtime-view.tsx`
- 测试：`src/features/knowledge/__tests__/` 交互与标签合同测试、headless QA 捕获脚本（#2031）
- 不改 shard 数据、Teaching Projection、生产 selector；不改 3D 与旧版图谱行为。
