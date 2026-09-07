## Context

新旧版图谱共用 `KnowledgeGraph2D` / `KnowledgeGraphCanvas`（react-force-graph）。生产实测（v0.7.4，demo 账号，`qa=task-7-4-performance` 快照）确认：hover 节点后全图节点持续漂移数秒（相机 zoom 恒定）；进入领域经历 16→27→85 节点三段跳变；跨领域关系以顶部横幅呈现且文案含义不明。上游 v0.37 分片中根轨迹域 22/85 节点的 `label` 为完整定义句。

已确认的根代码链：

- `KnowledgeGraphRuntimeCanvas`（knowledge-graph-runtime-canvas.tsx:108）每次渲染重建 `resolvedMaterializedNodeIds`（`nodes.map()` 兜底），且 `expandedNodeIds=[]`、`expandedDirectLinks=[]`、`activationSequenceByCenterId={}` 等默认参数每次新建引用；它们都在 `KnowledgeGraph2D` 的 `graphData` useMemo 依赖里（knowledge-graph-2d.tsx:589）。
- `graphData` 重算时 `preserveKnowledgeGraphLiveNodeCoordinates`（layout-engine.ts:284）按设计只续承位置/速度、丢弃 fx/fy（沉降冻结由 `freezeKnowledgeGraphUnaffectedScope` 在 engine stop 时写入 live 节点，不属于 pin store）。
- force-graph 的 graphData setter 对新载荷一律 `forceLayout.stop().alpha(1)` 全量重热（node_modules/force-graph/dist/force-graph.js:11870）。
- 为「结构不变即复用引擎载荷」设计的 `computeKnowledgeForceStructureSignature`（force-lifecycle.ts:76）从未被消费。
- 领域进入的分段来自 `visibleKeys` 渐进扩张（active-authority-graph.tsx:1371 初始 overview scope，1395 关系端点并入）与每段重热/重取景。
- 跨领域横幅为 active-authority-graph.tsx:1902 的 `boundaryCues` section；数据来自 family 分片 `boundaries`（含 canonicalId/label/adjacentDomainIds），当前文案「名称暂不可用」表明标签通道未被使用。
- #2031：headless 捕获环境下 2D 画布不响应真实指针（悬停预览/拖拽钉住均无）， QA 无法产出交互证据；指针命中依赖 `nodePointerAreaPaint` 与画布指针绑定，初始化条件待定位。

## Goals / Non-Goals

**Goals:**

- Hover/选择等纯渲染不再触发 graphData 重算与引擎重热；hover 只允许放大目标节点字形与显示预览浮层。
- 超长节点标签在画布层截断（子句/词边界 + 省略号），hover 预览与详情抽屉保留全称；不改分片数据。
- 领域进入在数据就绪且引擎沉降完成前只显示加载态，首帧即最终排列。
- 跨领域关系在 2D 画布内渲染：目标领域为大虚线圆（标领域名），跨领域概念为圆内节点按领域聚类，绘制真实跨域边；点击跨领域节点进入对应领域；移除顶部横幅。
- #2031：定位并修复 headless 下指针不响应的初始化条件，产品 QA 可捕获 hover 预览与拖拽钉住。

**Non-Goals:**

- 不改 shard/Teaching Projection 数据与生产 selector（教学关系恢复由独立 Runtime 发布完成）。
- 不改 3D 视图与旧版图谱的交互行为。
- 不为 22 个长句标签概念补上游短名（内容治理任务，另行立项跟踪）。
- 不删除 hover 预览浮层与显式「重新布局」入口。

## Decisions

1. **graphData 身份稳定化（双层）**
   - 第一层（直接修复）：`KnowledgeGraphRuntimeCanvas` 中 `resolvedMaterializedNodeIds` 用 `useMemo([materializedNodeIds, nodes])`；所有数组/对象默认参数提为模块级常量（`EMPTY_NODE_IDS`、`EMPTY_LINKS`、`EMPTY_ACTIVATION_SEQUENCE`）。
   - 第二层（结构护栏）：接线 `computeKnowledgeForceStructureSignature` —— `graphData` useMemo 输出前比较结构签名（节点 id 集 + 边端点集 + graphVersion + relayoutVersion），签名未变时复用上一帧的 `{nodes, links}` 引用，使任何非结构重渲染（hover、选择、预览）都无法触发 force-graph 重摄入。签名变化才重建载荷，保证披露/过滤/显式 reflow 行为不变。

2. **标签截断**
   - 在 `layoutKnowledgeNodeLabel` 之前增加一层 `deriveKnowledgeNodeCanvasName(name)`：超过显示预算（按 maxLines×maxWidth 折算字符上限）时按中文标点/子句边界截断并加省略号；`accessibleName`、hover 预览、详情抽屉、目录列表仍用全称。截断只发生在画布绘制入参。

3. **首帧门控**
   - 领域视图挂载后维护 `entrySettled` 状态：数据（域默认分片+教学覆盖）就绪前与引擎 `onEngineStop` 首次到达前，画布呈现加载占位（沿用现有加载文案）；`onEngineStop` 后一次性显示最终布局。中间阶段的 `visibleKeys` 并入在后台完成，不驱动可见帧。staticLayout（reduced-motion/测试）路径下以布局计算完成即视为沉降。

4. **跨领域画布渲染（`cross-domain-canvas-cluster`）**
   - 数据源：family 分片 `boundaries`（canonicalId/label/adjacentDomainIds）+ 跨界关系边（端点不在有界概览内的关系）。
   - 渲染：每个目标领域一个虚线大圆（领域名标注于圆周上方），该领域的跨领域概念节点排布在圆内；域内端点与跨界节点之间按真实关系绘制边（沿用既有 edge 呈现）。跨界节点沿用领域概念视觉样式 + 虚线晕圈（现有 `hasCrossDomainHalo` 装饰通道）。
   - 交互：点击跨界节点调用 `followBoundary`（进入对应领域）；hover 预览复用现有浮层，标签用 boundaries 携带的 label（超长时同样走决策 2 的截断）。
   - 移除 active-authority-graph.tsx 顶部 `boundaryCues` 横幅 section；banner 文案键从界面目录退役（`boundary.title` 等）。
   - 布局：领域圆作为画布边界锚点参与初始布局（置于概览外圈），不参与力导向漂移；沉降冻结对其同样生效。
   - 3D 与旧版不实现；3D 下跨界节点不渲染（保持现状的入口语义由目录/检索承担）。

5. **#2031 指针初始化**
   - 先定位 headless 不响应的条件（重点核对 `nodePointerAreaPaint` 命中区、画布 pointer 监听绑定时机、headless 下 `ResizeObserver`/首帧时序与 hit-test 坐标系），修复后以 qa=knowledge-product 捕获脚本产出悬停预览与拖拽钉住证据为验收。

## Risks / Trade-offs

- [结构签名复用掩盖真实变化] → 签名输入必须覆盖节点身份、边端点、graphVersion、relayoutVersion；签名一致即结构等价，渲染层属性（选中/hover/主题）本就不经 graphData 载荷生效。
- [标签截断失真] → 截断只影响画布标签；全称经 hover 预览、详情抽屉、可浏览目录与无障碍名称保留。
- [首帧门控延长感知等待] → 加载态替代跳变；85 节点域同步沉降在百毫秒级。
- [跨界圆占画面] → 虚线圆置于概览外圈、仅存在跨界关系时渲染；移除横幅后净画面占用下降。
- [#2031 若根因在依赖库] → 最小修复优先落在本仓库的绑定/初始化层；依赖级问题给出绕行与证据。

## Migration Plan

只改前端与测试。运行时数据不变。回滚即还原本变更的渲染层修改；教学关系恢复由已完成的独立 Runtime 发布承担，不回滚。
