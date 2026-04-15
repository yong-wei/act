# 部署与验收

适用场景：

- 需要重新部署远端
- 需要确认 `redis + worker + scheduler` 是否真正生效
- 需要核对环境变量与部署脚本

强制约束：

- 只允许本机构建镜像或镜像包，再在远端加载和部署；禁止远端 `podman build`、`docker build`、`npm run build`、`next build`
- 远端 `/home/projects/act` 不得保存源码；只保留运维脚本、环境变量文件和 `course-content/runtime`
- 不得通过上传源码、常驻远端代码目录或临时改造部署模式来绕过本机构建
- 若本次修改涉及 `deploy/podman/` 下的部署脚本，先确认这些文件已经被显式纳入 Git 版本控制；本仓库根级 `.gitignore` 默认忽略 `deploy/`，不要只在本地修改未跟踪脚本后直接执行远端部署

推荐顺序：

1. 本地验证
```bash
npm run lint
npm run test
npm run build
node scripts/tests/test-docker-migration-readiness.mjs
node scripts/tests/test-remote-deploy-script.mjs
```

2. 镜像构建
```bash
bash scripts/build.sh
```

3. 远端部署
```bash
bash scripts/remote-deploy.sh --skip-build
```

说明：

- `scripts/remote-deploy.sh` 只允许同步运维脚本、环境变量与 runtime，并在远端加载本地已构建好的镜像
- 若发现远端存在 `src/`、`prisma/`、`package.json` 等源码残留，先清理到最小运维壳层，再继续部署
- 若 `deploy/podman/deploy.sh` 已使用 `--add-host` 为 `app/worker` 注入数据库与 Redis 的静态主机映射，`deploy/podman/configure-service.sh` 必须在数据库就绪后重新执行 `4-deploy.sh --app-only`，不要再用 `podman start` 复用旧的 `app/worker` 容器；否则数据库或 Redis 重启后 IP 改变，旧容器内静态映射会立刻失效
- 当前生产环境中的应用与 worker 容器应统一使用：
  - `DATABASE_URL=postgresql://...@act-obe-postgres.dns.podman:5432/...&connection_limit=10&pool_timeout=20`
  - `REDIS_URL=redis://act-obe-redis.dns.podman:6379`
  - `POSTGRES_HOST=act-obe-postgres.dns.podman`
- 若只是更新远端运维脚本、systemd 行为或 runtime 资源，而本地镜像内容未变，优先执行 `bash scripts/remote-deploy.sh --skip-build`；不要反复全量构建镜像

4. 远端验收
```bash
ssh root@121.40.124.135 "podman ps -a --format 'table {{.Names}}\t{{.Status}}' | grep act-obe"
ssh root@121.40.124.135 "systemctl --no-pager --full status act-obe-stack.service | sed -n '1,80p'"
ssh root@121.40.124.135 "podman exec act-obe-redis redis-cli CONFIG GET maxmemory-policy"
ssh root@121.40.124.135 "podman exec act-obe-redis redis-cli --scan --pattern 'bull:*' | head -n 40"
ssh root@121.40.124.135 "podman exec act-obe-app /bin/sh -lc 'getent hosts act-obe-postgres.dns.podman act-obe-redis.dns.podman; printenv DATABASE_URL REDIS_URL POSTGRES_HOST || true'"
ssh root@121.40.124.135 "curl -k -I -s https://act.adapt-learn.online/"
ssh root@121.40.124.135 "curl -k -s https://act.adapt-learn.online/api/auth/session"
ssh root@121.40.124.135 "curl -k -s https://act.adapt-learn.online/api/readyz"
```

环境变量重点：

- `DATABASE_URL` 需带 `connection_limit=10&pool_timeout=20`
- `REDIS_URL=redis://act-obe-redis.dns.podman:6379`
- `POSTGRES_HOST=act-obe-postgres.dns.podman`
- `WORKER_NAME=act-obe-worker`
- `WORKER_CONCURRENCY=2`
- `APP_PORT` 要与远端实际运行端口一致

验收重点：

- 4 个核心容器都在运行
- Redis 策略为 `noeviction`
- BullMQ repeat jobs 已注册
- worker 日志能看到队列消费或快照创建
- 公网首页、认证接口与 `readyz` 全部正常
- 若为了验证脚本多次连续执行 `remote-deploy.sh --skip-build` 后触发 Podman/runc 级别异常，例如 `unable to freeze` 或 worker 停在 `Created`，优先做最小恢复：
  - 先确认 `readyz` 是否仍为 `app=true, db=true, redis=true`
  - 若仅 `worker` 未运行，优先 `podman start act-obe-worker`，不要直接再次全量重部署
