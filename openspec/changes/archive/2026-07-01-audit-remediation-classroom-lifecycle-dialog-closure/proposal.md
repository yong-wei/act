## Why

课堂生命周期已有身份、实时状态和结束态的基础整改，但多处教师页面与互动课教师 runtime 仍存在 native confirm、结束/删除影响不透明、课堂码/加入错误恢复不统一、demo/runtime 状态不同步等问题。下一阶段需要把建课、加入、投影、结束、删除和复盘入口作为完整课堂生命周期处理。

## What Changes

- 统一 class-bound、temporary、demo 和 real session 的生命周期状态与恢复语义。
- 替换关键课堂 native confirm/alert，提供影响预览、产品确认、执行状态和恢复。
- 对课堂码失效、加入失败、正在进行课堂复用、新开课堂、结束课堂、删除课堂和投影恢复提供一致 UI/API 口径。
- 回写审计报告和 evidence，只关闭被验证的课堂生命周期 finding。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `audit-remediation-teacher-classroom-lifecycle`: 扩展课堂创建、复用、结束、删除、加入和投影恢复闭环。
- `session-finalization-quality`: 要求结束课堂和学生结束态具备一致持久状态。
- `session-governance-readiness`: 要求课堂治理动作可恢复、可审计。

## Impact

影响教师班级详情、教案列表、互动课入口、教师 runtime、课堂加入、投影页、历史/复盘入口、session APIs 和移动/键盘验证。
