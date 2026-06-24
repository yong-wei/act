## Why

互动课程中的图片、工程对象图、仿真截图和示意图需要直接承载证据热点和图上任务，而不是把互动任务统一堆到页面底部。Product Design 合同要求注释媒体与画布内活动共享普通 activity 的提交和治理能力。

设计合同真源: `artifacts/product-design-audits/interactive-course-visual-components-2026-06-17/design-contract.md`

## What Changes

- 新增 `visual.annotatedMedia` 组件合同与共享 runtime。
- 新增 `visual.embedded-activity` 嵌入式活动层合同。
- 支持图片热点、标注线、局部放大、遮罩、证据标签和图上任务锚点。
- 图上选择、图上排序、连线、路径选择、局部判断和证据标注必须使用共享 response/evidence 合同。
- 教师端聚合热点选择、遗漏热点、画布内任务提交和误判分布。

## Capabilities

### Modified Capabilities

- `interactive-module-taxonomy`
- `interactive-response-contracts`
- `interactive-governance-evidence`

## Impact

- 依赖 `add-interactive-visual-stage-runtime`。
- 影响图片/媒体类互动课程页面、后台证据、教师诊断和工程语义泄露门禁。
- 不允许继续显示内部文件名、模块名、payload key 或未翻译图片标题。

## GitHub Coordination

- Parent issue: `#559`
- Executable issue: `#564`
- Planned dependency: after `#560`, `#565`, and `#561`.
