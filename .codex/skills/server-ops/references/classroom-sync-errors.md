# 课堂同步错误与 Failed to fetch 排查

适用场景：

- 课堂中出现 `同步错误`、`Failed to fetch`、`fail to fetch`
- 学生端不跟随教师进度
- 教师端推进步骤、结束课堂、显示答案或释放活动失败
- 3-7 或其他精品互动课实际上课后，需要从埋点判断错误来源

核心判断：

- 当前系统能把同步错误定位到角色、课步、接口、请求方法、HTTP 状态或浏览器网络层。
- 只有 `Failed to fetch` 而没有 HTTP 状态时，不能唯一断定服务器根因；它只说明浏览器没有拿到 HTTP 响应，需要结合服务端日志、同时间接口状态和浏览器网络上下文继续判断。
- 直接查库时不要只筛 `eventType='sync_error'`。前端基础事件通常落为 `eventType='error'`，语义事件名在 `eventData.eventType='sync_error'`。

代码链路：

- 诊断字段构造：`src/features/interactive/session-framework/fetch-diagnostics.ts`
- 课堂进度同步：`src/features/interactive/session-framework/use-session-progress-channel.ts`
- 学生/教师状态同步：`src/features/interactive/session-framework/use-session-state-channel.ts`
- 3-7 教师端上报：`src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/teacher-page.tsx`
- 3-7 学生端上报：`src/features/interactive/unit-3-7-steady-error-low-frequency-compensation/student-page.tsx`
- 事件落库：`src/app/api/interactive/events/route.ts`
- 目标表：`InteractionLog.eventData`

先取证，不先改代码：

1. 查同一课堂的同步错误事件
```sql
select
  "createdAt",
  "userId",
  "sessionId",
  "lessonKey",
  "stepId",
  "actorRole",
  "eventType",
  "eventData"
from "InteractionLog"
where "sessionId" = '<session-id>'
  and (
    "eventType" = 'error'
    or "eventData"->>'eventType' = 'sync_error'
  )
order by "createdAt" desc
limit 100;
```

2. 汇总失败来源
```sql
select
  "actorRole",
  "stepId",
  "eventData"->>'source' as source,
  "eventData"->>'method' as method,
  "eventData"->>'url' as url,
  "eventData"->>'errorName' as error_name,
  "eventData"->>'errorMessage' as error_message,
  "eventData"->>'status' as status,
  count(*) as count
from "InteractionLog"
where "sessionId" = '<session-id>'
  and (
    "eventType" = 'error'
    or "eventData"->>'eventType' = 'sync_error'
  )
group by 1, 2, 3, 4, 5, 6, 7, 8
order by count desc;
```

3. 远端同时段日志
```bash
ssh root@121.40.124.135 "podman logs --since 30m act-obe-app | grep -E 'api/session|session_state|Interactive Events API|Error updating session|Error fetching student states|Internal Server Error|Rate limit|Unauthorized|P1001|Timed out' | tail -n 200"
ssh root@121.40.124.135 "podman logs --since 30m act-obe-worker | tail -n 120"
ssh root@121.40.124.135 "curl -k -s https://act.adapt-learn.online/api/readyz"
```

字段解释：

| 字段 | 含义 |
| --- | --- |
| `source=session_progress_get` | 轮询 `/api/session/<id>` 读取课堂进度失败 |
| `source=session_progress_patch` | 教师 PATCH `/api/session/<id>` 推进步骤或结束课堂失败 |
| `source=teacher_state_get` | 教师读取全班状态 `/api/session/<id>/state?scope=teacher-view` 失败 |
| `source=student_state_get` | 学生读取个人状态与教师同步态 `/api/session/<id>/state?scope=student-view` 失败 |
| `source=session_state_post` | 学生作答或教师 reveal/release 状态写入失败 |
| `navigatorOnLine=false` | 客户端浏览器认为离线，优先判断学生端网络 |
| `documentVisibilityState=hidden` | 页面在后台，可能触发浏览器节流；结合连续失败次数判断 |
| `retryCount` | 课堂进度轮询连续失败计数；高值表示持续性问题 |
| `elapsedMs` | 请求耗时；极短失败多为网络/拦截，长耗时失败多看超时和服务端压力 |

分流规则：

- `errorName=HttpError` 且 `status=401`：登录态失效或未登录。查 `/api/auth/session`、NextAuth cookie、用户是否用匿名窗口或过期页面。
- `status=403`：教师修改非本人课堂，或角色不满足接口权限。重点查课堂 `teacherId`、当前用户 `role`。
- `status=404`：课堂不存在、sessionId 错误、学生使用了过期课堂链接。
- `status=429`：课堂接口限流。重点看同一用户是否触发请求风暴、是否频繁刷新或多端同时打开。
- `status=500`：服务端异常。立刻对齐 `act-obe-app` 日志；常见下一跳是 Prisma 数据库错误、Redis 访问异常或接口空值处理问题。
- `errorName=TypeError` 且 `errorMessage=Failed to fetch`：浏览器未拿到 HTTP 响应。若同时 `navigatorOnLine=false` 或 RTT 异常，优先客户端网络；若同一时间多用户同接口失败，优先公网、反代、应用进程或容器网络。

接口到后端排查点：

- `/api/session/<id>` GET：先查 Redis 会话缓存，再查数据库 `ClassSession`。若 readyz 中 Redis/DB 异常，先按基础设施排障。
- `/api/session/<id>` PATCH：查 `classroomRateLimiter`、教师权限、`BopppsStage`/`SessionStatus` 枚举、`ClassSession.update` 和 Redis 发布。
- `/api/session/<id>/state` GET：查登录态、`StudentState.findMany/findFirst/findUnique`，以及 `scope` 是否为 `teacher-view`、`student-view` 或 `self`。
- `/api/session/<id>/state` POST：查登录态、用户是否存在、payload 是否包含 `data`，以及 `StudentState.upsert` 的唯一键 `sessionId_userId_stateKey`。
- `/api/interactive/events` POST：查登录态、限流、事件 payload 是否有效；同步错误本身也要能成功上报，否则只能依赖浏览器控制台和服务端日志。

3-7 专项判断：

- 3-7 的教师端和学生端都通过统一 `session-framework` 上报同步错误；不要先假设是 3-7 页面单独逻辑。
- `scope=teacher-page` 表示教师端观察到错误；`scope=student-page` 表示学生端观察到错误。
- 如果教师端 `session_progress_patch` 失败，学生端随后出现 `session_progress_get` 或 `student_state_get`，先定位教师端 PATCH 的 HTTP 状态。
- 如果只有学生端 `student_state_get` 失败而教师端正常，多数是学生登录态、网络、浏览器后台节流或学生侧状态接口问题。
- reveal/release 不同步通常落在 `session_state_post` 或 `student_state_get`，不是课堂进度 PATCH。

完成排障报告时至少写清：

- 哪个 `sessionId`、`lessonKey`、`stepId`、角色受影响
- 主要失败 `source/url/method/status/errorName/errorMessage`
- 是 HTTP 响应错误、浏览器网络失败，还是服务端日志中的具体异常
- 是否多用户同时发生；若是，多半不是单个学生浏览器问题
- 最小下一步：修业务接口、处理基础设施、降低请求风暴、还是补充日志
