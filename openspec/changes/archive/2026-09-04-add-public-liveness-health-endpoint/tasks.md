- [x] 1.1 新增 `src/app/api/health/route.ts`：GET 返回 200 + `{ "status": "ok" }` 最小 JSON，无鉴权、无外部依赖调用，符合 route 契约（force-dynamic + rethrowIfNextDynamicError）
- [x] 1.2 路由契约测试：状态码、JSON 形状、无鉴权依赖；nextjs-dynamic-error 源码契约保持合规
- [x] 1.3 运维文档写明 liveness（/api/health）与 readiness（/api/readyz）分工
- [x] 1.4 typecheck 与相关测试通过

## 度量

- dev server 实测：GET /api/health → 200、{"status":"ok"}、Cache-Control: no-store、无鉴权。
- 契约测试 2/2（状态码/JSON 形状/no-store；无 prisma/redis/auth/runtime 依赖导入；无 try/catch 即无吞动态探测异常）。
- 运维分工文档 docs/operations/public-health-probes.md（liveness=/api/health，readiness=/api/readyz）。
- eslint 无问题；typecheck 由提交门禁覆盖。
