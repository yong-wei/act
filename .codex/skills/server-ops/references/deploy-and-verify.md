# 部署与验收

适用场景：

- 需要重新部署远端
- 需要确认 `redis + worker + scheduler` 是否真正生效
- 需要核对环境变量与部署脚本

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

4. 远端验收
```bash
ssh root@121.40.124.135 "podman ps -a --format 'table {{.Names}}\t{{.Status}}' | grep act-obe"
ssh root@121.40.124.135 "systemctl --no-pager --full status act-obe-stack.service | sed -n '1,80p'"
ssh root@121.40.124.135 "podman exec act-obe-redis redis-cli CONFIG GET maxmemory-policy"
ssh root@121.40.124.135 "podman exec act-obe-redis redis-cli --scan --pattern 'bull:*' | head -n 40"
ssh root@121.40.124.135 "curl -k -I -s https://act.adapt-learn.online/"
ssh root@121.40.124.135 "curl -k -s https://act.adapt-learn.online/api/auth/session"
```

环境变量重点：

- `DATABASE_URL` 需带 `connection_limit=10&pool_timeout=20`
- `REDIS_URL=redis://act-obe-redis:6379`
- `WORKER_NAME=act-obe-worker`
- `WORKER_CONCURRENCY=2`
- `APP_PORT` 要与远端实际运行端口一致

验收重点：

- 4 个核心容器都在运行
- Redis 策略为 `noeviction`
- BullMQ repeat jobs 已注册
- worker 日志能看到队列消费或快照创建
- 公网首页和认证接口正常
