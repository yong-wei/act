## Why

2026-09-04 QA 巡检（Issue #1941）发现 `/api/health` 返回 404，运维缺少通用、无副作用的存活探测端点。现有 `/api/readyz` 承担就绪检查（含 runtime 身份与依赖校验），语义重、不适合作为负载均衡与容器编排的轻量 liveness 探针；`/api/auth/session` 虽返回 200 但属于会话端点，不应被当作健康检查。

## What Changes

- 新增公开 `/api/health` 轻量存活端点：无鉴权、无数据库/外部依赖调用，返回 200 与最小 JSON（如 `{ "status": "ok" }` 与服务名/时间戳），表述「进程存活」而非「依赖就绪」。
- 不复用、不改动 `/api/readyz` 的就绪语义；两者分工在运维文档中写明（liveness=进程存活，readiness=依赖就绪）。
- 端点不泄露版本细节、内部路径或配置；响应允许缓存策略禁用（no-store）以避免探针缓存。
- 增加路由契约测试：200、JSON 形状、无鉴权依赖、动态渲染声明符合 route 契约（force-dynamic + rethrowIfNextDynamicError）。

## Capabilities

### New Capabilities

- `platform-liveness-probe`: 平台公开存活探测端点契约，区分 liveness 与 readiness 语义。

### Modified Capabilities

无。

## Impact

- 新增 `src/app/api/health/route.ts`。
- 新能力 spec 首次建立（归档时同步创建主 spec skeleton）。
- 运维文档（`docs/` 或部署说明）补充 liveness/readiness 分工说明。
- 路由契约测试（含 nextjs-dynamic-error 源码契约合规）。
- 不改 `/api/readyz`，不引入新的信息暴露面。
