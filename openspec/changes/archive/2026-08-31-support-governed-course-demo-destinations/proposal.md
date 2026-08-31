## Why

control-correction 注册表里的 simulation 节点已经指向真实受治理课程 student demo step（`unit-3-6-zero-design-workshop` 的 `step-11`），但 destination contract 的 simulation 分支只接受 `/simulations/*` 或已验证的 interactive resource context。真实 seed 因此被标成 `destination-contract-blocked`，Arena 前置链不可满足，真实规划器无法生成包含 simulation 与 Arena terminal 的可行主路径。Issue #1746。

## What Changes

- 在 `adaptive-path-destination-contract` 的 simulation 分支中，额外接受受治理课程 student demo step：
  `/interactive-learning/courses/<segment>/student/demo?step=<非空>`
- `<segment>` 必须通过 `isManifestCourseRouteSegment()`；不允许只凭 `/interactive-learning/courses/` 前缀放行任意课程页。
- 保留现有 `/simulations/*` 与已验证 interactive resource context 规则。
- 用 contract 单测、真实 seed 的 `planLearningPath` 集成断言，以及 24 名虚拟学生真实规划器实验覆盖该行为。

## Non-goals

- 不改规划算法、BKT、虚拟学生模型、实验指标。
- 不改 `control-correction-resource-seed.ts` 或数据库。
- 不把任意课程页面、教师页或缺 `step` 的 demo 放行。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `adaptive-learning-path-planning`: simulation 节点可把受治理课程 student demo step 当作合法 platform destination。

## Impact

- 受影响代码：`src/lib/adaptive-path-destination-contract.ts`、对应单测、assemble-plan / 真实 seed 规划验证。
- 行为影响：真实 control-correction simulation 不再因 destination contract 被挡；Arena 前置链可满足。
- 验证：contract 单测、assemble-plan 相关测试、typecheck；24 名虚拟学生真实规划器实验必须现场生成，不得复用旧 3 节点 / 48 分钟快照。
