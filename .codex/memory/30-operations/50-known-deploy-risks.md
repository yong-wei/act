# 已知部署风险

状态: active
最后更新: 2026-05-02
摘要: 汇总那些“反复出现、且容易被误判为源码问题”的部署与发布风险；当前已知风险除旧前端资源、Prisma 迁移、会话环境漂移、Redis OOM 后 worker 日志风暴、Podman 容器 DNS / systemd 重启链路失配外，还包括“未获明确部署指令时不得构建镜像”的协作边界。
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

## 风险 6: Podman DNS 可解析不代表 Node 业务进程稳定可用

症状:
- 容器内 `nslookup` 或 `dns.resolve4()` 能解析 `act-obe-postgres.dns.podman` / `act-obe-redis.dns.podman`
- 但应用或 worker 日志里仍出现 `getaddrinfo ENOTFOUND`
- `readyz` 出现 `db=false` 或 `redis=false`

解释:
- 在这台生产机的 `Podman + Alpine/musl + Node 18` 组合下，Podman `dnsname` 记录存在时，Node 的 `dns.lookup/getaddrinfo` 仍可能不稳定
- 因此不能只凭 `nslookup` 成功就认定运行态已恢复；必须看业务容器实际连接结果、`readyz` 和 worker 日志

## 风险 7: systemd 复用旧 app/worker 容器会保留过期静态主机映射

症状:
- `app` 与 `worker` 容器已经启动，但访问数据库或 Redis 时出现 `EHOSTUNREACH`
- `podman inspect act-obe-app --format '{{json .HostConfig.ExtraHosts}}'` 能看到静态主机映射
- 数据库或 Redis 容器在本次重启后 IP 已变化

解释:
- 当前部署链路会在创建 `app/worker` 时通过 `--add-host` 固定数据库与 Redis 主机映射，以绕开 Node `getaddrinfo` 抖动
- 若随后 systemd 只是 `podman start` 旧的 `app/worker` 容器，而数据库或 Redis 已获取新 IP，旧映射会立刻失效
- 因此 `configure-service.sh` 必须在数据库就绪后重新执行 `4-deploy.sh --app-only`，而不是直接复用旧容器

## 风险 8: 未获明确部署指令时不得构建镜像

症状:
- 用户只要求本地代码修改、配置抽取、验证或解释问题，但智能体开始执行 `scripts/build.sh`、`docker buildx build` 或创建部署用临时 worktree
- 业务逻辑没有要求上线，但本地开始生成或覆盖 `deploy/images/act-obe.tar`

解释:
- 镜像构建是部署流程的一部分，耗时长、会产生大文件，并可能扩大当前任务边界
- 除非用户明确要求“部署到服务器”“发布线上”“重新部署”等同义操作，否则不得构建镜像
- 普通本地验证应停在 `npm run lint`、`npm run test`、`npm run build`、配置 smoke 或定向接口测试；只有获得明确服务器部署指令后，才进入 `docker info`、`scripts/build.sh`、`scripts/remote-deploy.sh --skip-build`
