## Why

学生线剩余问题集中在 evidence-review intent、lessonId/slug 口径、补练上下文、任务完成写回、作品集收录状态和空路径误导。已有 adaptive center 和 student closure specs，但多个入口仍把缺失数据当普通页面展示。

## What Changes

- 把学生证据、补练、任务、成长、作品集和路径执行作为一个闭环整改。
- 要求 path-selection/path-execution/evidence-review 等 intent 在无活动路径或缺上下文时显示学生可理解的恢复状态。
- 补齐完成、回顾、继续、写回、收录和路径偏离状态。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `adaptive-learning-center-ui`: 要求真实空路径、坏 pathId、evidence-review 和 path execution 状态不再伪装为正常进度。
- `audit-remediation-student-learning-closure`: 要求任务、练习、证据、成长和作品集形成可审计写回闭环。
- `student-evidence-status`: 要求学生证据筛选、来源定位和完成状态使用统一证据语言。
- `adaptive-learning-path-planning`: 要求路径上下文、节点 launch 和证据回看保持稳定。

## Impact

影响 `/assessment/adaptive-practice`、student evidence/growth/portfolio/missions/profile routes、adaptive path execution state、student feedback task contracts and tests。
