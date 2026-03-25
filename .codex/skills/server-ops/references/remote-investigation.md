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

推荐顺序：

1. 容器与 systemd 状态
```bash
ssh root@121.40.124.135 "podman ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | grep act-obe"
ssh root@121.40.124.135 "systemctl --no-pager --full status act-obe-stack.service | sed -n '1,80p'"
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
ssh root@121.40.124.135 "podman exec act-obe-app /bin/sh -lc 'getent hosts act-obe-postgres; getent hosts act-obe-redis; cat /etc/resolv.conf'"
```

4. 核心 HTTP 验证
```bash
curl -k -I https://act.adapt-learn.online/
curl -k https://act.adapt-learn.online/api/auth/session
```

常见模式：

- `P1001`：应用到 PostgreSQL 不可达
- `ENOTFOUND act-obe-redis`：容器内 DNS 解析/网络别名问题
- `Timed out fetching a new connection from the pool`：连接池不足
- `Cannot read properties of null (reading 'user')`：服务端路由未处理空 session
