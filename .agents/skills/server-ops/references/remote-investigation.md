# 远端调查与故障排查

适用场景：

- 线上页面 500
- 服务不稳定
- 课堂同步失败
- 容器、数据库、Redis、worker 状态异常

项目约定：

- 服务器：`root@121.40.124.135`
- 域名：`https://act.adapt-learn.online`
- 关键容器：`act-obe-app`、`act-obe-postgres`、`act-obe-redis`、`act-obe-worker`
- systemd：`act-obe-stack.service`

边界约束：

- 远端只用于运行、日志、容器和网络排查，不用于源码构建
- 远端 `/home/projects/act` 只应保留运维脚本、环境变量文件与已物化的 OSS blob-view；不要把本地 `course-content/runtime` 当作线上内容树
- 排障时若发现远端保留了源码目录，应先记录现状，再清理为最小运维壳层

推荐顺序：

1. 容器与 systemd 状态
```bash
ssh root@121.40.124.135 "podman ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | grep act-obe"
ssh root@121.40.124.135 "systemctl --no-pager --full status act-obe-stack.service | sed -n '1,80p'"
ssh root@121.40.124.135 "find /home/projects/act -maxdepth 2 \( -name src -o -name prisma -o -name package.json \) -print"
```

2. 应用与 worker 日志
```bash
ssh root@121.40.124.135 "podman logs --tail 200 act-obe-app"
ssh root@121.40.124.135 "podman logs --tail 200 act-obe-worker"
ssh root@121.40.124.135 "podman logs --since 10m act-obe-app"
```

3. Redis 与数据库连通性
```bash
ssh root@121.40.124.135 "podman exec act-obe-redis redis-cli ping"
ssh root@121.40.124.135 "podman exec act-obe-redis redis-cli CONFIG GET maxmemory-policy"
ssh root@121.40.124.135 "podman exec act-obe-postgres pg_isready -U act_user -d act_obe"
ssh root@121.40.124.135 "podman exec act-obe-app /bin/sh -lc 'getent hosts act-obe-postgres act-obe-redis; printenv DATABASE_URL REDIS_URL POSTGRES_HOST || true; cat /etc/resolv.conf'"
```

4. 核心 HTTP 验证
```bash
curl -k -I https://act.adapt-learn.online/
curl -k https://act.adapt-learn.online/api/auth/session
curl -k https://act.adapt-learn.online/api/readyz
```

## 大型运行时清单的只读复核

Runtime Release v2 的 manifest 可能包含数千个对象。不要把完整 `files` 数组直接输出到终端，也不要为方便查看而在远端筛选或改写它。应在本地运行：

```bash
rtk npx tsx scripts/knowledge-cutover/capture-active-runtime-observation.ts
```

该脚本只在 `act-obe-app` 容器内读取已挂载的 v2/v1 manifest 与 active receipt，验证 receipt 与首选 manifest 身份一致，再将全量清单写入不可变的本地候选证据文件，并只输出 release、receipt、generation 与文件数摘要。复跑同一生产身份会校验既有捕获；身份漂移会拒绝覆盖。

常见模式：

- `P1001`：应用到 PostgreSQL 不可达
- `Digest: 1744748396`：教师首页服务端查询 `LessonPlan` 时命中数据库不可达；先查 `podman logs act-obe-app` 是否伴随 `P1001`
- `ENOTFOUND act-obe-redis`：容器内 DNS 解析/网络别名问题
- `Timed out fetching a new connection from the pool`：连接池不足
- `Cannot read properties of null (reading 'user')`：服务端路由未处理空 session

本次教师驾驶舱加固后的默认判断：

- 应用容器环境变量默认应使用 `act-obe-postgres` 与 `act-obe-redis` 这两个网络别名，不再把 `*.dns.podman` 作为默认主机名
- 若 `/api/readyz` 中 `db=false` 或 `redis=false`，先排基础连通性，再看业务页面日志，不要直接怀疑页面逻辑
