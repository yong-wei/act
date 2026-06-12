## Why

React Doctor state/effect error 中有一组集中在 `src/features/interactive` 的 manifest runtime、共享课程组件和单元课程页面。这些文件承载当前组件化互动课程主线，修复时必须保护学生/教师流程、模块合同和课程步骤状态。

本变更专门消除 manifest-first 互动课程实现中的状态同步与 effect error。

## What Changes

- 修复 `src/features/interactive/shared/*`、manifest runtime activity renderer、以及 `unit-*` 页面中的 state/effect error。
- 保持 manifest module contract、student/teacher rendering、step progress、activity answer state 和 media selection 行为不变。
- 对课程步骤切换、模块 identity 切换、学生作答保留、教师视图状态等关键交互增加代表性测试或浏览器验收。
- 使用 React Doctor `0.5.1` 本地 error-only 扫描验证该范围清零。

## Capabilities

### New Capabilities

- `interactive-course-state-effect-safety`: Defines state/effect safety requirements for manifest-first interactive course runtime and unit pages.

### Modified Capabilities

- None.

## Impact

- Affects currently flagged files under `src/features/interactive/shared`, `src/features/interactive/multi-representation-linkage`, and `src/features/interactive/unit-*`.
- Does not touch legacy `src/resources/interactive-learning` courses or simulation/widgets resources.
- Does not change module taxonomy, scoring semantics, or course content.
