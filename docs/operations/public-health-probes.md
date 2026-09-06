# 公共健康探测端点分工（liveness / readiness）

状态: active
最后更新: 2026-09-04
上游: [docs/ProjectDescription.md](../ProjectDescription.md)
相关: `src/app/api/health/route.ts`、`src/app/api/readyz/route.ts`

## 分工

| 端点 | 语义 | 鉴权 | 依赖调用 | 适用探针 |
| --- | --- | --- | --- | --- |
| `GET /api/health` | 进程存活（liveness） | 无 | 无（不触达数据库/Redis/runtime） | 负载均衡存活、容器 livenessProbe、外部拨测 |
| `GET /api/readyz` | 依赖就绪（readiness） | 无 | 数据库 `SELECT 1`、Redis ping、数学批改 worker 心跳、runtime 身份 | 容器 readinessProbe、发布验收、灰度放量判断 |

## 约定

- `/api/health` 恒返回 `200 {"status":"ok"}`（`Cache-Control: no-store`）。数据库或 runtime 不可用不影响该端点：它只回答「应用进程是否还在响应请求」。
- `/api/readyz` 在任一依赖不就绪时按既有语义报告不就绪。不要把 `/api/readyz` 当作 liveness 探针——依赖抖动会引发不必要的实例重启。
- `/api/auth/session` 返回 200 属于会话端点行为，不得当作健康检查使用（#1941 备注）。
- 两个端点均不泄露版本号、内部路径或配置。
