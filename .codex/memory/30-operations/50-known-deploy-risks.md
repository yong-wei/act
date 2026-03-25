# 已知部署风险

状态: active
最后更新: 2026-03-25
摘要: 汇总那些“反复出现、且容易被误判为源码问题”的部署与发布风险；当前已知风险除旧前端资源、Prisma 迁移和会话环境漂移外，还包括 Redis OOM 后 worker 日志风暴。
上游:
- [30-database-and-migrations.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/30-database-and-migrations.md)
下游:
- [../60-incidents/2026-03-16-session-api-auth-vs-deploy.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/60-incidents/2026-03-16-session-api-auth-vs-deploy.md)
- [../60-incidents/2026-03-25-worker-redis-oom-log-flood.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/60-incidents/2026-03-25-worker-redis-oom-log-flood.md)
相关:
- [../20-architecture/30-auth-and-session.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/20-architecture/30-auth-and-session.md)

## 风险 1: 旧前端资源与新后端共存

症状:
- 控制台报错与当前源码逻辑不一致
- 某个旧 chunk 名称无法在当前构建中找到

解释:
- 浏览器保留旧标签页、缓存或部署切换窗口期时，前端和后端可能来自不同版本

## 风险 2: Prisma 迁移元数据与真实 schema 不一致

症状:
- `500 Internal Server Error`
- Prisma 报某张表不存在

解释:
- 迁移可能部分执行、失败回滚不完整，或手工补表后未补记迁移

## 风险 3: 会话接口公开读取与受保护读取混淆

症状:
- 同时看到 `/api/session/[id]` 的异常和 `/state` 的 `401`

解释:
- 这两个接口权限模型不同，不能把同一时刻的两个报错默认归为同一根因

## 风险 4: NextAuth 相关环境漂移

症状:
- 浏览器有页面但拿不到稳定登录态
- 接口频繁 `401`

解释:
- `NEXTAUTH_URL`、`NEXTAUTH_SECRET` 或生产域名 cookie 条件不一致时，会导致会话恢复异常

## 风险 5: Redis OOM 后 worker 日志风暴

症状:
- 服务器磁盘被快速写满
- `act-obe-worker` 反复报 Redis/BullMQ 错误
- 即使 worker 容器已停止，空间也没有明显回收

解释:
- 若 Redis 命中 `maxmemory`，而 worker 又缺少熔断、冷却和日志节流，就会持续打印同类错误
- Podman stopped container 的 `ctr.log` 会继续占用容器存储目录；不删除容器时，磁盘不会自动回收
- 只做“调低频率”或“增大 Redis 容量”不足以根治，必须同时限制 BullMQ 历史任务并保证 worker 在基础设施异常下自我收敛
