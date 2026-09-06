## Context

新旧图谱共用 `KnowledgeGraph2D` / `KnowledgeGraphCanvas`。拟合 effect 依赖 `hoveredNode?.id` 并把 hover 标签放大计入包围盒，随后 `zoom`/`cameraPosition`。力导向按 #1739 在沉降后把非 pin 节点交还力学；拖动结束 `releaseKnowledgeGraphDragFrame` 会删掉其他节点的 `fx/fy`。新版过滤在顶栏 `ActiveAuthorityFilterPanel`；旧版是 `RelationFamilyControl` `bottom-3 left-3`。标签在 `projectedFontSize < 12` 时隐藏。`GovernedRichText density=detail` 与 `GovernedBlockMath` 提供「复制公式」。

## Goals / Non-Goals

**Goals:**

- Hover 只放大被划节点；相机、画布缩放、其他节点不动。
- 初始化沉降后布局冻结；拖谁只动谁。
- 新版过滤改用旧版左下角标签；位置贴画布最左下角。
- 标签常显示，上限内优先画面中心。
- 去掉可见复制公式/全文按钮。

**Non-Goals:**

- 不删除 hover 预览浮层。
- 不删除显式 reflow / 用户取消钉住。
- 不在本变更改教学数据或卡/资源身份。

## Decisions

1. **相机与 hover 解耦**  
   2D/3D 拟合依赖与 `getKnowledgeGraphViewportFit` / `getKnowledgeGraph3DSafeFitCameraDistance` 不再接收 `hoveredNodeId`。拟合只响应首次 settle、`fitViewRequest`、resize、用户缩放。

2. **Hover 放大仅限目标字形**  
   `getKnowledgeNodeScale({ focused })` 只对 hover/selected 的**当前节点**生效。禁止 3D `viewportScale` 或邻居 mesh 因 hover 改变。其他节点半径、坐标、相机距离不变。

3. **沉降后全图钉死**  
   `onEngineStop` 后给当前可见节点写 `fx/fy/(fz)`。`handleNodeDrag` 只更新被拖节点。`handleNodeDragEnd` **不再** `releaseKnowledgeGraphDragFrame` 解开其他人。显式 reflow / unpin-all / 新范围到达才允许局部 reheat。这覆盖 #1739「普通节点保持力学所有权」。

4. **过滤 UI**  
   Active 画布挂载与旧版相同的 compact-bottom-left 芯片：教学顺序 + 工程四族（可含「全部」）。从 chrome 顶栏撤掉 `ActiveAuthorityFilterPanel`。CSS 用 `bottom-0 left-0`（控灵展开时 `left-20`）。对象类型筛选可并入同一芯片行，不得回到顶栏。

5. **标签**  
   取消「非 candidate 且字号 < 12 则隐藏」。可见上限保留；排序：selected > hovered > 距视口中心距离。手机大域仍可用目录作辅助，但画布中心标签必须常显到上限。

6. **复制**  
   `GovernedRichText` / `GovernedBlockMath` 产品路径 `showCopy=false`。无障碍仍可用 `copyLatex` 字段，不渲染按钮。

## Risks / Trade-offs

- [过滤改左下角与现行顶栏面板 spec 冲突] → 本变更明确修改 `layered-authority-domain-workspace`。
- [全钉死后筛选新边] → 仅新到达端点局部 reheat，其余保持钉。
- [常显标签性能] → 硬上限 + 中心优先 + 碰撞仍 defer。

## Migration Plan

只改前端与测试。无需数据迁移。回滚即还原拟合/力导向/过滤挂载。

## Open Questions

无。
