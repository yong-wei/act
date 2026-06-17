## Why

当前推导呈现接近卡片堆叠，无法表达真实课堂中“任意位置出现、局部显影、长公式分段、局部变色和跨区域关联”的推导过程。用户明确要求推导显影支持非线性显影，公式必须严格以 LaTeX 渲染，并支持公式分块、变色和长公式逐步显示。

设计合同真源: `artifacts/product-design-audits/interactive-course-visual-components-2026-06-17/design-contract.md`

## What Changes

- 新增 `visual.derivationStage` 组件合同与共享 runtime。
- 支持二维任意位置显影，不限制为从上到下。
- 公式以 LaTeX 源作为真源，支持公式块、语义色、长公式分段、局部高亮和跨区域连接。
- 教师端支持前进、后退、任意跳转、临时高亮、答案揭示和停留分布。
- 学生端记录显影浏览状态、公式块关注事件和按显影步骤提交的答案。

## Capabilities

### Modified Capabilities

- `interactive-module-taxonomy`
- `interactive-response-contracts`
- `interactive-governance-evidence`

## Impact

- 依赖 `add-interactive-visual-stage-runtime`。
- 影响 manifest runtime、KaTeX/LaTeX 渲染、教师同步、学生提交证据和浏览器视觉验收。
- 不允许用图片、纯文本或纵向卡片列表替代公式推导。
