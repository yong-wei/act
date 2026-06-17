## Context

当前控制工作台已经具备 `ControlFigureWorkspace`、`CONTROL_ANALYSIS_PANELS`、时域/Bode/Nyquist/根轨迹/性能指标面板、Rust/WASM 分析 worker 和 fallback。互动课程需要的是课程编排、教学任务锚点和证据记录，不是另一套数值面板。

## Design Contract

本变更直接引用 Product Design 合同:

- `artifacts/product-design-audits/interactive-course-visual-components-2026-06-17/design-contract.md`

合同中的视觉与复用要求是验收闸门。实现只要出现课程私有重复控制面板、万能 `interactive-figure` 入口、缺少深浅色适配或缺少后台证据记录，即判定未完成。

## Decisions

1. 课程 manifest 只能通过注册 capability 引用控制工作台能力。
2. 现有控制工作台中已有的曲线、坐标、图例、手柄、fallback、可访问性语义不得在单课目录复制。
3. 课程可以声明初始参数、可见 panel、教学提示、任务锚点、教师释放状态和学生提交记录。
4. 如果课程需要新的控制分析显示状态，应扩展共享工作台或共享 panel，而不是在 `unit-*` 下创建局部替代实现。

## Acceptance Evidence

- 设计合同路径。
- 控制工作台嵌入的视觉稿或方向稿路径。
- 学生端浅色、学生端深色、教师端浅色、教师端深色截图。
- 状态矩阵截图: 学生未释放、学生已释放、参数已改动、学生提交后、教师揭示、fallback 或 unsupported、教师诊断。
- manifest audit。
- 后台证据记录样本，包含参数快照、panel id、学生操作、教师释放或揭示状态。
