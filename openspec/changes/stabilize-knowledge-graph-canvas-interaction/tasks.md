## 1. Hover 漂移修复（引擎载荷身份稳定）

- [ ] 1.1 `KnowledgeGraphRuntimeCanvas`：`resolvedMaterializedNodeIds` 改为 `useMemo`（依赖 `[materializedNodeIds, nodes]`）；`expandedNodeIds` / `expandedDirectLinks` / `activationSequenceByCenterId` 等数组/对象默认参数提为模块级常量
- [ ] 1.2 `KnowledgeGraph2D`：接线 `computeKnowledgeForceStructureSignature`，结构签名（节点 id 集 + 边端点集 + graphVersion + relayoutVersion）不变时复用上一帧 `graphData` 引用；签名变化才重建
- [ ] 1.3 测试：hover 进入/离开后节点坐标与 `graphData` 引用不变；选择/预览重渲染不触发重热；结构变化（披露/过滤/reflow）仍正常重热

## 2. 标签展示层截断

- [ ] 2.1 新增 `deriveKnowledgeNodeCanvasName`：超出画布标签预算（maxLines×maxWidth 折算）时按中文标点/子句/词边界截断并加省略号
- [ ] 2.2 画布绘制（`paintNode`）使用截断名；hover 预览、详情抽屉、可浏览目录、`accessibleName` 保留全称
- [ ] 2.3 测试：长句标签截断含省略号且不超过行数上限；全称通道不受影响

## 3. 领域进入首帧门控

- [ ] 3.1 领域视图增加 `entrySettled` 门控：数据就绪 + 首次 `onEngineStop` 前显示加载占位，就绪后一次性呈现最终布局；中间 `visibleKeys` 扩张不驱动可见帧
- [ ] 3.2 staticLayout / reduced-motion 路径以布局计算完成作为沉降里程碑
- [ ] 3.3 测试与浏览器验证：进入领域后无 16→27→85 式分段跳变，首帧即最终排列

## 4. 跨领域画布渲染

- [ ] 4.1 从 family 分片 `boundaries` 与跨界关系边构建画布模型：按 `adjacentDomainIds` 聚类生成领域圆（虚线、领域名标注）与圆内跨领域节点
- [ ] 4.2 2D 画布渲染：领域圆锚定概览外圈、不参与力导向；域内端点与跨界节点绘制真实边；节点沿用领域概念样式与虚线晕圈
- [ ] 4.3 交互：点击跨界节点走 `followBoundary` 进入对应领域；hover 复用预览浮层
- [ ] 4.4 移除 `active-authority-graph.tsx` 顶部 `boundaryCues` 横幅 section，退役横幅文案键（`boundary.title` 等）
- [ ] 4.5 测试：同领域多概念聚类为一圆；无跨界关系时不渲染圆与横幅；点击进入目标领域

## 5. #2031 headless 指针初始化

- [ ] 5.1 定位 headless 捕获环境下 2D 画布不响应真实指针的初始化条件（命中区、指针绑定时机、首帧时序）
- [ ] 5.2 修复后产品 QA 捕获脚本能产出悬停预览与拖拽钉住证据（qa=knowledge-product）

## 6. 验证

- [ ] 6.1 `rtk npm run typecheck` 零错误、相关客户端测试通过
- [ ] 6.2 本地浏览器验收：hover 无漂移、标签截断、进入无跳变、跨界圆渲染与点击进入
- [ ] 6.3 `rtk openspec validate stabilize-knowledge-graph-canvas-interaction --type change --strict` 通过
