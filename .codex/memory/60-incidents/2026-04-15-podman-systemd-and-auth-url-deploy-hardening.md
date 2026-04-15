# 2026-04-15 Podman Systemd 与认证地址部署加固

状态: active
最后更新: 2026-04-15
摘要: 记录 2026-04-15 教师驾驶舱线上修复过程中暴露出的稳定部署问题：远端 systemd 接管 Podman 容器时的 cgroup/残留状态错误、`app/worker` 容器在 Alpine/musl + Node 18 下对 Podman 容器 DNS 的 `getaddrinfo` 解析不稳定、远端镜像重复上传浪费时间，以及生产环境仍继承 `NEXTAUTH_URL=http://localhost:3001` 导致退出登录跳回本地地址；并给出已落地的脚本级修复。
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
- 这台生产机上的 `Podman + Alpine/musl + Node 18` 组合下，运行中 `app/worker` 容器对 Podman 容器名的 `dns.lookup/getaddrinfo` 存在不稳定现象；`nslookup` 与 `dns.resolve4()` 能拿到结果，不代表 Node 业务进程里的 `getaddrinfo` 一定可用。
- 因此 `deploy/podman/deploy.sh` 需要在创建 `app/worker` 时，把数据库与 Redis 的短主机名和 `.dns.podman` 全限定主机名同时写入 `--add-host`；而 `deploy/podman/configure-service.sh` 不能再简单 `podman start` 旧的 `app/worker` 容器，而必须在数据库就绪后重新执行 `4-deploy.sh --app-only`，否则数据库或 Redis 重启换 IP 后，旧容器里的静态主机映射会立即失效。
- 生产应用容器不能直接继承远端 `.env` 中的 `NEXTAUTH_URL=http://localhost:3001`；部署脚本必须把 localhost/127.0.0.1 形式的认证基址归一化为 `https://$APP_DOMAIN`。
- 远端正式镜像包与本地镜像包 SHA256 一致时，应跳过重复上传，只继续装载与部署。
- 根级 `.gitignore` 默认忽略 `deploy/`，因此任何 `deploy/podman/*.sh` 修复都必须先确认文件已被显式纳入版本控制；否则会出现“本地脚本已修好、远端分支却没有这些修复”的假进展。

## 关键事实

- 本地镜像包 `deploy/images/act-obe.tar` 与远端 `/home/projects/act/images/act-obe.tar` 在本次最终修复期保持同一 SHA256：`814da6dcbc8b6aeecba384d8fd0c8fbd1d7d17e3bbb59362af79120f91e440ba`，后续重部署均使用 `--skip-build` 跳过重复上传。
- `configure-service.sh` 修复后，远端 `act-obe-stack.service` 可稳定达到 `active (exited)`，且数据库等待阶段实际使用的密码已变为 `act_pass`，不再误回落到 `ChangeMe_Act_2026!`。
- `deploy.sh` 修复后，远端应用容器环境已变为：
  - `NEXTAUTH_URL=https://act.adapt-learn.online`
  - `DATABASE_URL=postgresql://act_user:act_pass@act-obe-postgres.dns.podman:5432/act_obe?schema=public&connection_limit=10&pool_timeout=20`
  - `REDIS_URL=redis://act-obe-redis.dns.podman:6379`
- 验收时 `https://act.adapt-learn.online/api/readyz` 返回 `{"app":true,"db":true,"redis":true,...}`，`/api/auth/session` 返回空会话对象 `{}`，说明公网基本链路恢复。
- 线上实测中，运行中 `app/worker` 容器里的 `dns.lookup('act-obe-postgres.dns.podman')` / `dns.lookup('act-obe-redis.dns.podman')` 可能返回 `ENOTFOUND`，但同容器内 `nslookup` 与 `dns.resolve4()` 能拿到 IP；这说明问题在 Node 的 `getaddrinfo` 路径，而不是 Podman `dnsname` 完全失效。
- 当 systemd 用 `podman stop/start` 复用旧的 `app/worker` 容器时，数据库和 Redis 会拿到新的 `10.89.3.x` 地址，但旧容器内 `ExtraHosts` 仍指向旧 IP，最终表现为 `EHOSTUNREACH`、`worker` 冷却或 `readyz` 中 `db=false`。
- 本次还发现 `scripts/remote-deploy.sh` 的验收逻辑本身也会漂移：当 systemd 行为从“直接 start 旧容器”改成“执行 `4-deploy.sh --app-only` 重建容器”后，远端验证脚本也必须同步更新，否则会出现“服务已经健康，但部署脚本仍报失败”的假阴性。

## 本次脚本级修复

- `scripts/remote-deploy.sh`
  - `--skip-build` 下先比较远端正式镜像包 SHA256；一致时直接跳过上传。
  - 远端部署验证已改成校验 `5-configure-service.sh` 内是否通过 `APP_DEPLOY_SCRIPT --app-only` 重建应用栈，并核对 `app/worker` 的 `REDIS_URL` 为 `.dns.podman` 形式。
- `deploy/podman/configure-service.sh`
  - 先读取 runtime 环境，再从 `DATABASE_URL` 派生数据库密码。
  - 生成的 systemd unit 增加 `KillMode=none`、`Delegate=yes`。
  - 旧 `DATABASE_URL` 缺失连接池参数时，自动补齐 `connection_limit=10` 与 `pool_timeout=20`。
  - 不再 `podman start` 旧的 `redis/app/worker` 容器，而是在数据库就绪后直接调用 `4-deploy.sh --app-only` 重建应用栈。
- `deploy/podman/deploy.sh`
  - 删除旧容器时，`podman rm -f` 失败会自动回退到 `podman container cleanup --rm`。
  - 旧 `DATABASE_URL` 缺失连接池参数时自动补齐。
  - 生产环境下把 `NEXTAUTH_URL` 的 localhost/127.0.0.1 形式归一化为 `https://$APP_DOMAIN`。
  - 在创建 `app/worker` 时，为数据库与 Redis 同时注入短主机名和 `.dns.podman` 全限定主机名的静态 `--add-host` 映射，并优先以容器当前 IP 做 TCP 就绪探测。
- Git 跟踪范围
  - `deploy/podman/README.md`、`deploy/podman/deploy.sh`、`deploy/podman/configure-service.sh`、`deploy/podman/container-start-wrapper.sh` 已通过 `.gitignore` 例外规则显式纳入版本控制，避免部署修复只停留在本地未跟踪文件。

## 后续操作建议

- 若再次遇到 `podman rm -f` 报 `conmon exited prematurely` 或 `conmon died without writing exit file`，优先怀疑上一次失败的 systemd/Podman 接管残留，不要先怀疑数据库数据损坏。
- 若再次看到 `readyz` 的 `db=false` 或 `worker` 日志里的 `ENOTFOUND act-obe-postgres.dns.podman` / `ENOTFOUND act-obe-redis.dns.podman`，先检查运行中 `app/worker` 容器的 `ExtraHosts`、`DATABASE_URL`、`REDIS_URL` 和 `5-configure-service.sh` 是否仍在调用 `4-deploy.sh --app-only`，不要先回退回短主机名方案。
- 若再次出现退出登录跳回 `http://localhost:3001/login`，先检查运行中应用容器的 `NEXTAUTH_URL`，不要先改页面路由。
- 再次执行生产部署时，优先使用 `bash scripts/remote-deploy.sh --skip-build`；若本地镜像与远端一致，脚本会自动跳过重复上传。
- 若只是为了验证脚本再次连续重跑多次 `remote-deploy.sh --skip-build` 后触发 Podman/runc 自身错误，例如 `unable to freeze` 或某个容器停在 `Created`，优先做最小恢复并重新人工验收，不要把这类运行时异常直接等同于教师工作台业务修复失败。
