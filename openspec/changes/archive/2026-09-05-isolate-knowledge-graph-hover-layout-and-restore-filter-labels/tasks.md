## 1. Hover 与相机隔离

- [x] 1.1 从 2D/3D 拟合 effect 与 viewport-fit 输入中移除 `hoveredNodeId`
- [x] 1.2 允许 hover 放大当前节点字形，禁止改变其他节点半径/坐标和相机距离
- [x] 1.3 添加测试：hover 不调用 zoom/centerAt/cameraPosition；其他节点 transform 不变

## 2. 力导向冻结与拖动隔离

- [x] 2.1 首次 `onEngineStop` 后为可见节点写入 fx/fy/(fz)
- [x] 2.2 `handleNodeDragEnd` 不再释放其他节点；只 pin 被拖节点
- [x] 2.3 更新 drag-isolation / force-runtime 测试：松手后其他节点保持固定；显式 reflow 仍可局部重热

## 3. 左下角过滤与标签

- [x] 3.1 新版画布改挂 compact-bottom-left 关系芯片（教学顺序 + 工程族），撤掉顶栏 ActiveAuthorityFilterPanel
- [x] 3.2 新旧版芯片放到 `bottom-0 left-0`（控灵展开时 left-20）
- [x] 3.3 去掉远景字号隐藏闸；按最大可见数 + 画面中心优先绘制标签
- [x] 3.4 删除 GovernedRichText/GovernedBlockMath 产品路径上的复制公式/全文按钮

## 4. 验证

- [x] 4.1 新旧版浏览器验收：hover 只放大当前节点；拖动不带动全局；过滤在最左下角；远景仍有中心标签；抽屉无复制公式
- [x] 4.2 跑 `openspec validate isolate-knowledge-graph-hover-layout-and-restore-filter-labels --type change --strict` 与相关客户端测试
