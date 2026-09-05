## 1. 删除旧实现

- [ ] 1.1 删除两个旧 Active SVG 画布和 active-authority-graph 中仅供旧画布使用的颜色、边界及端点函数，保留现役共享模块。
- [ ] 1.2 删除旧几何函数的测试导入与专属断言；保留当前 force、语义、选择、详情和焦点测试。

## 2. 更新引用并验证

- [ ] 2.1 将 QA 捕获和商业 UI 检查的当前源码列表改为实际共享渲染链，使用既有流程更新受影响的当前证据，保留历史归档。
- [ ] 2.2 运行 Active Authority 客户端、runtime view、force lifecycle 及相关共享图谱测试；通过现有 2D/3D 与 Legacy 模式浏览器回归和受影响商业 UI 检查。
- [ ] 2.3 运行 typecheck、受影响文件 lint、本 change 的 OpenSpec strict 与 diff 检查；完成说明列出代码和测试删除量，确认相关生产代码净减少。
