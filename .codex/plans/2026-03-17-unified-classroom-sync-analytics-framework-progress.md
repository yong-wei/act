# 统一课堂同步与分析框架 - 进展摘要

最后更新：2026-03-17

## 已完成

### Task 1：Prisma 与事件契约升级

- `StudentState` 新增：
  - `stateKey`
  - `lessonKey`
  - `lastClientEventAt`
- `StudentState` 唯一键改为：
  - `@@unique([sessionId, userId, stateKey])`
- `InteractionLog` 新增：
  - `resourceKey`
  - `lessonKey`
  - `stepId`
  - `actorRole`
  - `attemptKey`
  - `clientEventAt`
- `InteractionLog.resourceId` 改为可空，并保留旧 `resourceId` 兼容写入
- 新增：
  - `ClassSessionReport`
  - `StudentSessionReport`
- `/api/interactive/events` 已兼容 `resourceKey ?? resourceId`
- `/api/session/[sessionId]/state` 已支持显式 `stateKey`
- 已通过：
  - `node scripts/tests/test-unified-classroom-schema.ts`
  - `node scripts/tests/test-classroom-event-api-contract.ts`
  - `npx prisma validate`

### Task 2：统一课堂同步框架

- 新增目录：
  - `src/features/interactive/session-framework/`
- 已落地：
  - `useSessionProgressChannel`
  - `useSessionStateChannel`
  - `useStudentLessonSession`
  - `useTeacherLessonSession`
  - `session-contract.ts`
  - `index.ts`
- `/api/session/[sessionId]/state` 已新增：
  - `scope=teacher-view`
  - 返回分桶：
    - `courseStates`
    - `teacherStates`
- 注意：
  - `stateRecords` 是“原始返回”
  - `courseStates` 才是课程态列表
  - `teacherStates` 才是教师同步态
- 已通过：
  - `node scripts/tests/test-session-framework-contract.ts`
  - `node scripts/tests/test-session-state-scope.ts`

### Task 3：统一课程事件与共享埋点层

- 新增：
  - `src/lib/classroom-analytics/event-taxonomy.ts`
  - `src/features/interactive/session-framework/build-course-event.ts`
  - `src/features/interactive/session-framework/use-course-event-tracking.ts`
- `useInteractiveTracking` 已升级：
  - 缓存键包含 `resourceKey + sessionId + userId`
  - 兼容旧 `resourceId`
- `useInteractiveAI` 已支持 `onEvent`
- `InteractiveProvider` 已接通 AI 事件链
- 已修复：
  - AI 提问重复记两条 `ai_query`
- 课程语义事件名当前进入：
  - `eventData.eventType`
- 已通过：
  - `node scripts/tests/test-course-event-tracking-contract.ts`
  - `node scripts/tests/test-classroom-event-api-contract.ts`

## 已完成补充

### Task 4：迁移 `L-2d`

- 已完成：
  - 教师/学生页接入统一 session hooks
  - 课程页不再手写旧双轮询
  - 工作区参数变化、步骤浏览、提交事件已接入统一课程事件流
  - 显式使用：
    - `stateKey='course'`
    - `stateKey='teacher-sync'`
- 额外修补：
  - `teacher-view` 回填完成前，不允许首次写回 `teacher-sync`
  - 教师页改为“服务端 revealedAnswers + 本地 draft”合并策略，避免刷新后把已揭题状态覆盖成空对象
  - `session_finalize` 改为仅在 `finishSession()` 成功后发送
  - 共享层已暴露 `teacherViewHydrated`
- 新增回归测试：
  - `scripts/tests/test-l2d-teacher-sync-behaviors.ts`
- 已通过：
  - `node scripts/tests/test-l2d-teacher-sync-behaviors.ts`
  - `node scripts/tests/test-l2d-session-framework-adoption.ts`
  - `node scripts/tests/test-l2d-event-coverage.ts`
  - `npm run lint -- --file src/features/interactive/l2d-three-domain-linkage/teacher-page.tsx --file src/features/interactive/session-framework/use-session-state-channel.ts --file src/features/interactive/session-framework/use-teacher-lesson-session.ts --file src/features/interactive/session-framework/session-contract.ts --file src/lib/l2d-course.ts`

## 当前进行中

### Task 5：迁移 `L-sum`

- 目标：
  - 复用统一 session hooks
  - 接通统一课程事件追踪
  - 显式 teacher-sync adapter 表达 released / revealed 状态
  - 为后续结束课堂固化分析留出报告读取入口

## 后续任务

- Task 5：迁移 `L-sum`
- Task 6：结束课堂固化分析 + 超时自动关闭
- Task 7：浏览器验证、文档更新、落地说明

## 压缩时最重要的上下文

- 不要回退现有工作区里与本任务无关的修改。
- 共享层已完成，后续课程迁移必须优先复用：
  - `useStudentLessonSession`
  - `useTeacherLessonSession`
  - `useCourseEventTracking`
- 后续课程页不要直接手写 `tracking.emit(...)` 去拼课程语义事件。
- 课程语义事件名当前不在 DB `eventType` 主字段，而在：
  - `InteractionLog.eventData.eventType`
- 旧埋点链路仍需兼容 `resourceId`；新代码应优先传 `resourceKey`。
- 教师页做聚合时优先读：
  - `courseStates`
  - `teacherStates`
  不要把 `stateRecords` 直接当成课程态列表。
