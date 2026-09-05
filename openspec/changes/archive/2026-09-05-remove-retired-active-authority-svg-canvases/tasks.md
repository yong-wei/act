# 1. 删除旧实现

- [x] 1.1 删除两个旧 Active SVG 画布和 active-authority-graph 中仅供旧画布使用的颜色、边界及端点函数，保留现役共享模块。
- [x] 1.2 删除旧几何函数的测试导入与专属断言；保留当前 force、语义、选择、详情和焦点测试。

# 2. 更新引用并验证

- [x] 2.1 将 QA 捕获和商业 UI 检查的当前源码列表改为实际共享渲染链（runtime-view + runtime-canvas），用既有捕获流程重捕获 486/487/489/462 当前证据，保留历史归档。
- [x] 2.2 运行 Active Authority 客户端、runtime view、force lifecycle 及相关共享图谱测试；重捕获流程覆盖 2D/3D 与 Legacy 模式浏览器回归（29 状态 + 视觉矩阵 + 角色证据），商业 UI 治理与基线同构（残余失败均为基线既有债务，见完成说明）。
- [x] 2.3 运行 typecheck、受影响文件 lint、本 change 的 OpenSpec strict 与 diff 检查；完成说明列出代码和测试删除量，确认相关生产代码净减少。

## 完成说明（任务 2.3）

生产代码净减少：`src/features` + `src/lib` 生产文件 +0/-682 行（含测试 -693，全 diff 11 文件 +1866/-2733，其余为证据 JSON 与 QA 脚本）。删除明细：

- `active-authority-force-canvas.tsx`（267 行）、`active-authority-root-canvas.tsx`（217 行）整文件删除。
- `active-authority-graph.tsx` 孤立几何块 198 行（nodeFill/nodeStroke、多边形/圆角矩形边界、端点计算、形状常量）。
- 客户端测试移除旧端点几何断言与导入。

QA/治理脚本对齐现役运行时的修订（同一 change 范围）：

- 捕获与治理源码列表改为 `active-authority-runtime-view.tsx` + `graph/knowledge-graph-runtime-canvas.tsx`；DOM 合同检查落到实际渲染链。
- 共享运行时兄弟结构对齐：节点选择器以 `[data-active-authority-runtime="force-graph"]` 为父级；root 层不再以 stage 缺席为判据；根域经 sr-only 目录 DOM click 进入。
- legacy 视图常驻隐藏挂载的 root 预载属于现行行为：显式检查仅豁免 `?mode=root`，active 安全投影排除该常驻流量；legacy 域展开与候选 API 仍被禁止。
- 身份泄漏 token 收集豁免 `*Label` 本地化展示字段（`predicateLabel`/`directionLabel` 如「关联」不是内部身份）。
- 移动端首屏节点目录标签断言与 compact 标签可见性断言随 #1742 目录移除退役，改为标签层结构合同；`nodeLabelReadability` 保留为观测记录。

验证记录：typecheck 零错误；改动文件 ESLint 无问题；knowledge 域 831 用例中 829 通过（2 个基线既有失败，见下）；governance 单测 3 个失败与基线逐项相同（基线既有债务）。商业 UI 治理脚本失败集与 integration 基线同构且少一项（node-label-unreadable 已随合同退役消除）：

- `knowledge-graph-interaction-state-485` 截图缺失：#1617 外置工件后生产脚本已删除，基线既有缺口。
- `tools-inspector-487` mobile-inspector `escape-did-not-close`：#1742 面板改造后现役产品的 Escape 行为与 2026-08-26 证据时点不一致，基线既有，非本 diff 引入（本 diff 未触及 inspector 产品代码；面板打开与焦点管理证据均通过）。
- `adaptive-path-product-qa` / `compact-spacing` 证据不完整：基线既有。

残余风险与建议 follow-up：上述三项基线缺口建议另立 issue 治理（485 需重建捕获链或退役校验；487 需核实移动端 inspector Escape 行为是否符合设计）。

Codex review P1 处理补充：

- 可达性校验恢复：`clickIfPresent`/`switchKnowledgeMode` 真实指针点击 + 多点 elementFromPoint 采样；整元素遮挡诚实失败。诚实失败暴露现役产品缺陷：移动端 (≤320px) legacy 模式按钮被页面容器完全遮挡（无滚动路径），受影响 5 个移动端 legacy 状态以 `result: 'blocked'` + occludedBy 诊断记录，不伪造通过。
- 身份泄漏扫描只记录计数，命中样本不写入公开证据或异常日志。
- 移动端节点可读性门禁保留在治理端（`node-label-unreadable` 拒绝项）：重捕获证据如实记录 320px 视图 `visibleNodeLabelCount: 0`（#1742 移除可见目录后画布未绘制可读节点名），该状态不被认证为通过，作为治理失败项暴露给 follow-up 修复。
