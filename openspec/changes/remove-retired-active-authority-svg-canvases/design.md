## Context

调查基于 `integration` 的 `f0399d234`。生产链路为 `KnowledgeGraphWorkspace → ActiveAuthorityGraph → ActiveAuthorityRuntimeView → KnowledgeGraphRuntimeCanvas → 共享 2D/3D 画布`。

旧 `active-authority-force-canvas.tsx`（267 行）和 `active-authority-root-canvas.tsx`（217 行）已无生产调用。`active-authority-graph.tsx:774–970` 的 nodeFill、nodeStroke、activeAuthorityNodeBoundaryPoint、activeAuthorityEdgeEndpoints 属于旧实现残留。客户端测试约 1928 行仍验证旧端点几何；QA 捕获脚本 57–58 行、商业 UI 检查脚本 2437–2438 行仍登记旧文件。

## Goals / Non-Goals

删除旧 Active 专用实现及其测试耦合，完成现有共享画布架构的收尾。保留共享 `graph/knowledge-graph-2d.tsx`、`graph/knowledge-graph-canvas.tsx`、`knowledge-graph-system.tsx` 和 Legacy 模式；不改布局算法、语言切换、Authority 读取、发布或回滚机制。

## Decisions

1. 直接删除两个旧文件及其孤立辅助函数，不建立转发组件。确认仍被当前语义投影使用的类型与函数后保留它们。
2. 删除仅针对旧几何函数的导入和断言。保留 `active-authority-force-runtime.test.ts`；它测试的是当前 force 生命周期，不能因名称相似误删。选择、详情、焦点恢复、关系语义和 2D/3D 状态测试继续有效。
3. 当前 QA 源码列表使用 `active-authority-runtime-view.tsx`、`knowledge-graph-runtime-canvas.tsx` 及实际参与绘制的共享模块。旧文件的证据引用不构成生产依赖。受影响当前证据通过现有捕获流程更新，历史归档保留原修订含义，不批量改写旧证据或另建证据系统。
4. 完成说明记录删除文件、辅助函数和测试，并核对相关生产代码净减少；无需新建扫描器、预算表或完整迁移报告。

## Risks / Trade-offs

当前 QA 不能通过替换路径后沿用旧源码校验值伪装成新捕获。对这次删除执行共享画布的现有聚焦测试和浏览器回归；已完成的整体 Force 迁移不重新立项，现行产品行为与安全要求继续适用。

## Migration Plan

源码、测试和当前 QA 引用一起调整，无数据库迁移或生产切换。
