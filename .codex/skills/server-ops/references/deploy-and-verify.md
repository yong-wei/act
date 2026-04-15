# 部署与验收

适用场景：

- 需要重新部署远端
- 需要确认 `redis + worker + scheduler` 是否真正生效
- 需要核对环境变量与部署脚本

强制约束：

- 只允许本机构建镜像或镜像包，再在远端加载和部署；禁止远端 `podman build`、`docker build`、`npm run build`、`next build`
- 远端 `/home/projects/act` 不得保存源码；只保留运维脚本、环境变量文件和 `course-content/runtime`
- 不得通过上传源码、常驻远端代码目录或临时改造部署模式来绕过本机构建

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

4. 远端验收
```bash
ssh root@121.40.124.135 "podman ps -a --format 'table {{.Names}}\t{{.Status}}' | grep act-obe"
ssh root@121.40.124.135 "systemctl --no-pager --full status act-obe-stack.service | sed -n '1,80p'"
ssh root@121.40.124.135 "podman exec act-obe-redis redis-cli CONFIG GET maxmemory-policy"
ssh root@121.40.124.135 "podman exec act-obe-redis redis-cli --scan --pattern 'bull:*' | head -n 40"
ssh root@121.40.124.135 "podman exec act-obe-app /bin/sh -lc 'getent hosts act-obe-postgres act-obe-redis; printenv DATABASE_URL REDIS_URL POSTGRES_HOST || true'"
ssh root@121.40.124.135 "curl -k -I -s https://act.adapt-learn.online/"
ssh root@121.40.124.135 "curl -k -s https://act.adapt-learn.online/api/auth/session"
ssh root@121.40.124.135 "curl -k -s https://act.adapt-learn.online/api/readyz"
```

环境变量重点：

- `DATABASE_URL` 需带 `connection_limit=10&pool_timeout=20`
- `REDIS_URL=redis://act-obe-redis:6379`
- `POSTGRES_HOST=act-obe-postgres`
- `WORKER_NAME=act-obe-worker`
- `WORKER_CONCURRENCY=2`
- `APP_PORT` 要与远端实际运行端口一致

验收重点：

- 4 个核心容器都在运行
- Redis 策略为 `noeviction`
- BullMQ repeat jobs 已注册
- worker 日志能看到队列消费或快照创建
- 公网首页、认证接口与 `readyz` 全部正常
