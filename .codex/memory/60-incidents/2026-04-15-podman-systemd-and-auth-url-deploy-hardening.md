# 2026-04-15 Podman Systemd 与认证地址部署加固

状态: active
最后更新: 2026-04-15
摘要: 记录 2026-04-15 教师驾驶舱线上修复过程中暴露出的稳定部署问题：远端 systemd 接管 Podman 容器时的 cgroup/残留状态错误、远端镜像重复上传浪费时间，以及生产环境仍继承 `NEXTAUTH_URL=http://localhost:3001` 导致退出登录跳回本地地址；并给出已落地的脚本级修复。
上游:
- [00-index.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/60-incidents/00-index.md)
- [30-database-and-migrations.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/30-operations/30-database-and-migrations.md)
下游:
- [10-release-checklist.md](/Users/YW/Documents/Site/act.just.edu.cn/.codex/memory/70-workflows/10-release-checklist.md)
相关:
- [deploy.sh](/Users/YW/Documents/Site/act.just.edu.cn/deploy/podman/deploy.sh)
- [configure-service.sh](/Users/YW/Documents/Site/act.just.edu.cn/deploy/podman/configure-service.sh)
- [remote-deploy.sh](/Users/YW/Documents/Site/act.just.edu.cn/scripts/remote-deploy.sh)

## 结论

- 生产部署模式必须保持“本机构建镜像包，远端仅装载镜像与运维脚本”；此次排障已经证明，问题不在部署模式本身，而在远端运维脚本的稳健性。
- `act-obe-stack.service` 若直接以默认 systemd cgroup 接管方式串行拉起 Podman 容器，可能触发 `unable to freeze`、`conmon died without writing exit file` 等残留状态错误；unit 需要显式设置 `KillMode=none` 与 `Delegate=yes`。
- `deploy/podman/deploy.sh` 删除旧容器时不能只依赖 `podman rm -f`；对于 conmon 残留导致的异常退出容器，必须回退到 `podman container cleanup --rm`。
- 生产应用容器不能直接继承远端 `.env` 中的 `NEXTAUTH_URL=http://localhost:3001`；部署脚本必须把 localhost/127.0.0.1 形式的认证基址归一化为 `https://$APP_DOMAIN`。
- 远端正式镜像包与本地镜像包 SHA256 一致时，应跳过重复上传，只继续装载与部署。

## 关键事实

- 本地镜像包 `deploy/images/act-obe.tar` 构建成功后，远端 `/home/projects/act/images/act-obe.tar` 与本地 SHA256 一致：`75590cb5a31d96858d3a77e946cd8449721e15a7bf2c83e03dbc9e30c4888151`。
- `configure-service.sh` 修复后，远端 `act-obe-stack.service` 可稳定达到 `active (exited)`，且数据库等待阶段实际使用的密码已变为 `act_pass`，不再误回落到 `ChangeMe_Act_2026!`。
- `deploy.sh` 修复后，远端应用容器环境已变为：
  - `NEXTAUTH_URL=https://act.adapt-learn.online`
  - `DATABASE_URL=postgresql://act_user:act_pass@act-obe-postgres:5432/act_obe?schema=public&connection_limit=10&pool_timeout=20`
  - `REDIS_URL=redis://act-obe-redis:6379`
- 验收时 `https://act.adapt-learn.online/api/readyz` 返回 `{"app":true,"db":true,"redis":true,...}`，`/api/auth/session` 返回空会话对象 `{}`，说明公网基本链路恢复。

## 本次脚本级修复

- `scripts/remote-deploy.sh`
  - `--skip-build` 下先比较远端正式镜像包 SHA256；一致时直接跳过上传。
- `deploy/podman/configure-service.sh`
  - 先读取 runtime 环境，再从 `DATABASE_URL` 派生数据库密码。
  - 生成的 systemd unit 增加 `KillMode=none`、`Delegate=yes`。
  - 旧 `DATABASE_URL` 缺失连接池参数时，自动补齐 `connection_limit=10` 与 `pool_timeout=20`。
- `deploy/podman/deploy.sh`
  - 删除旧容器时，`podman rm -f` 失败会自动回退到 `podman container cleanup --rm`。
  - 旧 `DATABASE_URL` 缺失连接池参数时自动补齐。
  - 生产环境下把 `NEXTAUTH_URL` 的 localhost/127.0.0.1 形式归一化为 `https://$APP_DOMAIN`。

## 后续操作建议

- 若再次遇到 `podman rm -f` 报 `conmon exited prematurely` 或 `conmon died without writing exit file`，优先怀疑上一次失败的 systemd/Podman 接管残留，不要先怀疑数据库数据损坏。
- 若再次出现退出登录跳回 `http://localhost:3001/login`，先检查运行中应用容器的 `NEXTAUTH_URL`，不要先改页面路由。
- 再次执行生产部署时，优先使用 `bash scripts/remote-deploy.sh --skip-build`；若本地镜像与远端一致，脚本会自动跳过重复上传。
