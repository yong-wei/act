## Why

当前互动课程 runtime 主要以纵向模块堆叠呈现，无法承载类似课堂 PPT、工程图解、公式显影和图上活动的二维布局。Product Design 合同要求新增 manifest-first 的自由视觉舞台，作为非数值视觉组件的共享底座。

设计合同真源: `artifacts/product-design-audits/interactive-course-visual-components-2026-06-17/design-contract.md`

## What Changes

- 新增 `visual.stage` 作为互动课程页面级视觉舞台。
- 舞台支持规范化坐标、响应式缩放、稳定宽高、层级、显影状态、教师控制和画布内活动锚点。
- 建立视觉舞台的深浅色、学生端、教师端、移动端和投影端验收要求。
- 明确舞台不得退化为 `space-y-4` 纵向列表或卡片容器。

## Capabilities

### Modified Capabilities

- `interactive-module-taxonomy`
- `interactive-course-standard-module-migration`
- `interactive-governance-evidence`

## Impact

- 后续推导显影、方框图、信号流图、注释媒体、画布内活动都依赖此底座。
- 不替代现有 `compute.panel` 和控制工作台。
- 需要新增浏览器视觉验收和 manifest audit。
