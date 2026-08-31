## 1. Destination contract

- [x] 1.1 扩展 simulation 分支，接受 `/interactive-learning/courses/<segment>/student/demo?step=<非空>`，并用 `isManifestCourseRouteSegment()` 校验 segment
- [x] 1.2 单测：真实 unit-3-6 demo step 放行；课程根路径、缺 step、未注册 segment 继续 blocked；`/simulations/*` 与 resource context 规则不变

## 2. Real seed planner

- [x] 2.1 对未改写 destination 的 `buildControlCorrectionResourceNodeRegistry()` 断言 simulation 不是 `destination-contract-blocked`，且 `planLearningPath` 能生成含 simulation 与 Arena terminal 的非空 `mainPath`
- [x] 2.2 运行 24 名虚拟学生真实规划器实验；结果必须来自现场 `planLearningPath`，不得复用旧 3 节点 / 48 分钟快照

## 3. Verification

- [x] 3.1 相关 contract / assemble-plan 测试与 typecheck 通过
