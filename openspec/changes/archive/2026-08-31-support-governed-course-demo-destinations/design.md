## Context

`resolveAdaptivePathDestinationContract()` 在规划装配里决定节点是否 `destination-contract-blocked`。simulation 当前只承认：

- pathname 以 `/simulations/` 开头
- 或 `/interactive-learning/resources/<id>` 且 source context 校验通过

真实 seed 的 `launchTarget` 是：

`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-11`

该 URL 已是 `unit-3-6` 的 `previewDemoPath`，且 route segment 在 `MANIFEST_COURSE_ENTRY_LOADERS` 中。测试里用 `withLegalSimulationDestinations()` 把课程 demo 改写成 `/simulations/<sourceRef>` 只是绕过 contract，不能当作实验结果。

## Goals / Non-Goals

**Goals:**

- simulation 合法 destination 增加受治理课程 student demo step。
- 用 `isManifestCourseRouteSegment()` 校验课程段，`step` 查询参数必须非空。
- 真实 seed 规划出含 simulation 与 Arena terminal 的非空 `mainPath`。

**Non-Goals:**

- 不改 seed、规划器、BKT 或实验指标实现。
- 不把 `/interactive-learning/courses/<segment>` 本身或教师路由当成 simulation destination。

## Decisions

### Reuse `isManifestCourseRouteSegment`, do not prefix-match courses

在 `hasIntegratedJourneyDestination` 的 simulation 分支增加第三条件：pathname 为 `/interactive-learning/courses/<segment>/student/demo`，且 `isManifestCourseRouteSegment(segment)`，且 URL `step` 查询值为非空字符串。课程段白名单与 `isManifestCourseRouteSegment()` 放在 `manifest-course-route-segments.ts`；`manifest-course-app-loaders` 再导出同一真源。destination contract 不得静态导入 loaders 模块，否则会把全部课程页 dynamic import 拉进 worker TypeScript graph。

既有反例 `/interactive-learning/courses/unit-1-2-modeling-from-object-to-system`（无 `/student/demo?step=`）继续 `unsupported-resource-type`。

### Keep destination context optional for course demo steps

`/simulations/*` 不要求 registry source context。课程 demo step 同样按 URL 形态 + 注册课程段判断，不要求 `interactive-learning/resources` 的 source 三元组；否则真实 seed 仍会被 `missing-resource-source-context` 挡住。

### Real planner experiment is live `planLearningPath`

24 名虚拟学生实验必须对未改写 destination 的真实 `buildControlCorrectionResourceNodeRegistry()` 调用 `planLearningPath`。禁止把旧的 3 节点 / 48 分钟路径当结果写回。

## Risks / Trade-offs

- [lib 引用 features 的课程路由守卫] → destination contract 已引用 `@/features/arena/data/seed-challenges`；课程段守卫是同等的注册表白名单，不引入规划策略。
- [过宽放行课程页] → 强制 `/student/demo` + 非空 `step` + `isManifestCourseRouteSegment`，单测覆盖缺 step、未注册 segment、课程根路径。

## Migration Plan

无需数据迁移。回滚即恢复仅 `/simulations/*` 的 simulation 规则，真实 seed 会再次被挡住。
