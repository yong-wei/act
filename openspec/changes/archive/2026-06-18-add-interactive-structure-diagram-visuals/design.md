## Context

控制系统结构图是控制课程的核心语言。视觉组件必须能表达路径、节点、回路、端口和错误位置，不能只把图形作为静态插图。信号流图还必须让 Mason 公式的路径项与图中元素建立可见对应关系。

## Design Contract

本变更引用 Product Design 合同第 4.2 节 `visual.block-diagram-builder` 和第 4.3 节 `visual.signal-flow-graph`。图形结构、路径高亮、学生证据、教师诊断和深浅色适配均为验收闸门。

## Decisions

1. 方框图和信号流图是共享 visual module，不在单课页面私有绘制。
2. 图形结构以 manifest 中的节点、边、支路和路径集合为真源。
3. 图形支持展示、教师显影、学生构造和诊断模式。
4. 所有学生交互都通过共享 response/evidence 路径记录。
5. 可见标题、图例和错误说明必须是教学语义，不能泄露节点内部 id 或 payload key。

## Acceptance Evidence

- 方框图和信号流图视觉稿或方向稿路径。
- 学生端、教师端、浅色、深色截图。
- 非默认状态截图: 路径高亮、学生构图后、教师揭示或错误诊断。
- manifest audit。
- 后台证据样本: 节点选择、路径选择、构图位置、参考差异、教师揭示路径。
