## Why

React Doctor error-only 扫描中的状态/effect error 有一部分位于共享组件、hooks、Arena、Control Workbench、Knowledge 和管理端等活跃平台表面。这些文件处在当前产品主路径上，机械修复可能影响导航、预览、知识面板和管理操作状态。

本变更先处理共享与活跃平台表面的状态同步、effect cleanup 和依赖稳定性问题，形成可复用修复模式。

## What Changes

- 修复共享组件、providers、hooks、Arena、Control Workbench、Knowledge、Admin 等非课程资源目录中的 React Doctor state/effect error。
- 将 prop 派生状态改为派生值、key 重置或 render 阶段安全调整。
- 为 timer、订阅、事件监听或异步副作用补充 cleanup。
- 为可变依赖改为稳定 immutable identity、primitive signature 或 `useMemo`。
- 增加代表性测试，证明状态重置、用户编辑态保留和 cleanup 行为没有回归。

## Capabilities

### New Capabilities

- `shared-react-state-effect-safety`: Defines React state/effect safety requirements for shared components and active platform surfaces.

### Modified Capabilities

- None.

## Impact

- Affects currently flagged files under `src/components`, `src/hooks`, `src/features/arena`, `src/features/control-workbench`, `src/features/knowledge`, `src/features/admin`, and `src/features/lesson-engine`.
- Does not modify interactive lesson unit pages, legacy resource decks, widgets, or simulation resources; those are covered by sibling changes.
- Validation remains local-only and pins React Doctor to `0.5.1`.
