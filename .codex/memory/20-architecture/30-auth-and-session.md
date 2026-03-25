# 鉴权与课堂会话

状态: active
最后更新: 2026-03-19
摘要: 说明 NextAuth 会话、课堂会话 API、学生状态 API 之间的关系，是排查 401/403/500、课堂翻页不同步和学生端提交异常的关键入口。
上游:
- [20-course-runtime.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/20-architecture/20-course-runtime.md)
下游:
- [../30-operations/50-known-deploy-risks.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/50-known-deploy-risks.md)
- [../60-incidents/2026-03-16-session-api-auth-vs-deploy.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/60-incidents/2026-03-16-session-api-auth-vs-deploy.md)
相关:
- [src/lib/auth.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/lib/auth.ts)
- [src/app/api/session/[sessionId]/route.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/app/api/session/[sessionId]/route.ts)
- [src/app/api/session/[sessionId]/state/route.ts](/Users/YW/Documents/Site/act.just.edu.cn/src/app/api/session/[sessionId]/state/route.ts)

## 鉴权主链路

- 项目使用 NextAuth JWT session
- `session.user` 在回调中补充 `id`、`role` 和可选 `studentProfile`
- 教师/学生不同页面会根据 `session.user.role` 决定可见入口和跳转逻辑

## 会话接口分层

- `GET /api/session/[sessionId]`: 公开读取课堂会话的最小信息，主要供学生端同步当前步骤
- `PATCH /api/session/[sessionId]`: 受保护接口，通常仅教师或管理员可修改课堂进度
- `GET /api/session/[sessionId]/state`: 受保护接口，读取学生状态或教师同步广播
- `POST /api/session/[sessionId]/state`: 受保护接口，学生或教师写入自己的状态数据

## 2026-03-19 后的课堂同步约束

- 学生端默认以轮询为主，`useStudentLessonSession` 中 `enableSSE` 默认关闭
- SSE 代码仍保留，但当前仓库约定是不把它作为真实课堂默认模式
- 学生端页面不应向学生暴露“实时连接失败，已降级到轮询模式”之类的技术错误

## 当前稳定的数据流约定

- `GET /api/session/[sessionId]` 的 Redis 快路径必须返回 `joinCode`、`classId`、`planTitle`、`currentItemId`、`currentStage`、`status`
- `GET /api/session/[sessionId]/state?scope=student-view` 只应返回当前学生自己的 `courseState`、最新 `teacher-sync` 和 `totalStudents`
- 学生端不再为 `student-view` 拉取全班 `participantStates`，否则 100+ 学生课堂下轮询成本会失控
- `teacher-view` 仍可读取全班 `courseStates`，用于教师端汇总

## 排障时必须先区分的两件事

- `/api/session/[sessionId]` 报错，优先怀疑 `ClassSession` 或相关查询本身
- `/state` 返回 `401`，优先确认登录态，而不是立即怀疑数据库

## 当前已知排障经验

- 学生页通常会同时轮询 `/api/session/[sessionId]` 与 `/state?scope=student-view`
- 浏览器控制台里同时看到 `500` 和 `401` 时，这两者未必是同一个根因
- 如果教师端能翻页但学生端迟迟不同步，先确认 `student-view` 是否只返回 `selfState + teacherSyncState`，再判断是否需要怀疑 Redis/SSE
- 如果课堂码或页面标题在教师端消失，先检查 `/api/session/[sessionId]` Redis 快路径是否遗漏了 `joinCode/classId/planTitle`
