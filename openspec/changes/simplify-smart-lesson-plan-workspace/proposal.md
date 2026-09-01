## Why

智能备课页的 `SmartLessonPlanWorkspace` 同时处理任务索引、课程依据、教材范围、Konling 建议确认、生成 job 轮询、课件跳转、返回位置和本地提示状态。相同的 task revision、source binding、stage status 和 approval identity 又在 `src/lib/smart-lesson-plan`、API route 与 preparation document editor 中重复建模，产生大量派生状态和 effect。

本 change 是 M8 的第二项简化（C32），依赖 C28 的 canonical AI/provider runtime，并与 C31 平行。目标是删除重复索引、转换和 alias，让现有 smart-lesson-plan domain/service 及 preparation editor 保持唯一事实与编辑边界，同时保留教师备课、审核、生成恢复和课堂交接行为。

## What Changes

- 以 `src/lib/smart-lesson-plan` domain/service/lifecycle 和现有 preparation document editor 作为 task、draft、source、goal、stage、approval、job 与 revision 的唯一 owner。
- 将 workspace 限定为 route projection、选择/筛选临时状态和已有 action dispatch；删除可由 canonical projection 推导的重复 task/status/source state、polling alias 和旧事件桥。
- 复用现有 course-basis、textbook range、Konling suggestion confirmation、generation queue/worker、outline editor 和 return-state contract。
- 保留源版本/hash/citation、teacher approval、单次 correction、retry/resume、class context、权限、SSR、AppShell 及 AI advisory/privacy 边界。
- 以 before/after 测试覆盖新建任务、筛选/归档、建议确认、生成/失败/重试、编辑/冲突、课件跳转、refresh 和返回位置。

## Capabilities

### New Capabilities

- `smart-lesson-plan-workspace-simplification`: 规定智能教案工作区的单一 task owner、薄交互层和行为保持边界。

### Modified Capabilities

None. `smart-lesson-plan-authoring`、`interactive-ai-context-continuity` 和 `smart-courseware-publication` 的内容、AI 会话和发布要求不变；本 change 不改变业务语义。

## Impact

- 主要范围：`src/features/teacher/smart-lesson-plan-workspace.tsx`、`src/lib/smart-lesson-plan/*`、`src/features/teacher/preparation-document-editor/*`、`src/app/api/teacher/smart-lesson-tasks/**`、smart-prep routes 与测试。
- 前置依赖 C28；C31/C32 不互相依赖，均不得创建新的通用编辑/AI workspace。
- 不改 Prisma schema、`PlatformSetting`、任务/教案数据模型、课程 runtime、课堂绑定、AppShell/角色/SSR/R3F、`verify:commit`/`verify:push`/`typecheck` 或 release/rollback validator。
