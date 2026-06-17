## Why

互动课程中方框图和信号流图目前容易退化为静态图片、粗糙 SVG 或表格说明，无法表达控制系统结构、反馈回路、路径高亮、Mason 公式来源和学生构图证据。Product Design 合同要求这些图形成为共享 visual 组件，而不是课程私有绘图。

设计合同真源: `artifacts/product-design-audits/interactive-course-visual-components-2026-06-17/design-contract.md`

## What Changes

- 新增 `visual.blockDiagram` 和 `visual.signalFlowGraph` 组件合同与共享 runtime。
- 方框图支持传函块、求和点、分支点、输入输出、扰动、传感器、信号线、端口、反馈回路和构图/诊断模式。
- 信号流图支持节点、支路增益、前向路径、回路、不接触回路组合和 Mason 公式对应高亮。
- 学生端图形选择、路径判断、构图结果和错误诊断必须进入后台证据。
- 教师端必须显示节点/路径/回路误判分布和热力诊断。

## Capabilities

### Modified Capabilities

- `interactive-module-taxonomy`
- `interactive-response-contracts`
- `interactive-governance-evidence`

## Impact

- 依赖 `add-interactive-visual-stage-runtime`。
- 影响互动课程图形类页面、manifest 审计、学生提交证据和教师统计。
- 不重做数值计算，不替代控制工作台。
