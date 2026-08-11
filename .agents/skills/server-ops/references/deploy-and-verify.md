# 部署与验收

适用场景：

- 需要重新部署远端
- 需要确认 `redis + worker + scheduler` 是否真正生效
- 需要核对环境变量与部署脚本

强制约束：

- 只允许本机构建镜像或镜像包，再在远端加载和部署；禁止远端 `podman build`、`docker build`、`npm run build`、`next build`
- 本地镜像构建必须走 Docker：使用本机 Docker 守护进程运行 `bash scripts/build.sh`，由脚本内的 `docker buildx build` 导出镜像包；若 Docker 未运行，先启动 Docker 并用 `docker info` 验证后再构建，不得自行改用 Colima、Podman、Lima 或其他 builder
- 远端 `/home/projects/act` 不得保存源码；只保留运维脚本、环境变量文件和 `course-content/runtime`
- 不得通过上传源码、常驻远端代码目录或临时改造部署模式来绕过本机构建
- 本次构建失败时不得直接沿用旧的 `deploy/images/act-obe.tar` 部署；必须先完成新的 Docker 构建并记录新的 SHA256
- 若本次修改涉及 `deploy/podman/` 下的部署脚本，先确认这些文件已经被显式纳入 Git 版本控制；本仓库根级 `.gitignore` 默认忽略 `deploy/`，不要只在本地修改未跟踪脚本后直接执行远端部署
- Docker Desktop 发布资源固定为 24 GiB 内存、8 GiB Swap；构建统一使用 `NODE_MAX_OLD_SPACE_SIZE=12288` 和 `NODE_OPTIONS=--max-old-space-size=12288`。`scripts/build.sh` 的 20 GiB VM 门禁失败时必须停止，不得继续构建或改用 6/8 GiB heap 试探
- 当前构建仍在运行时等待其自然结束，不得为了调整 Docker Desktop 或清理 BuildKit 中断构建
- 完成远端验收并确认没有其他获授权构建后，退出 Docker Desktop 释放 VM 内存；仅停止 buildx builder 不等价于关闭 Docker Desktop

推荐顺序：

1. 发布前资源、仓库与远端容量预检
```bash
rtk docker info --format 'mem_bytes={{.MemTotal}}'
rtk proxy jq '{MemoryMiB,SwapMiB}' "$HOME/Library/Group Containers/group.com.docker/settings-store.json"
rtk git status --short
rtk ssh root@121.40.124.135 "df -h /; podman system df"
```

要求：

- Docker Desktop 设置值必须为 `MemoryMiB=24576`、`SwapMiB=8192`；Docker VM 可见内存受虚拟化开销影响可以略低于 24 GiB，但不得低于脚本的 20 GiB 门槛
- 先确认远端有足够空间接收镜像 tar、完成 `podman load` 并保留数据库备份；空间不足时先精确核对未使用镜像、旧 tar 与 external Buildah 容器，保留当前版本的直接前驱回滚镜像
- 工作树必须与目标提交一致；镜像、runtime、检索索引与 provenance 使用同一完整 Git revision，不以 tag 名或短 SHA 代替内容身份

2. 本地验证
```bash
rtk npm run lint
rtk npm run test
rtk npm run build
rtk node scripts/tests/test-docker-migration-readiness.mjs
rtk node scripts/tests/test-remote-deploy-script.mjs
```

图谱、schema 或权威数据变化还必须在本地完成对应 migration/import dry-run、验证脚本和失败回滚路径。Candidate、Shadow 与 Legacy 并存是合法状态；部署不得隐式切换生产 authority。

3. 镜像构建
```bash
rtk docker info
IMAGE_TAG='localhost/act-obe-platform:<version>-<short-sha>' \
OUTPUT_TAR='deploy/images/act-obe-<version>-<short-sha>.tar' \
NODE_MAX_OLD_SPACE_SIZE=12288 \
NODE_OPTIONS='--max-old-space-size=12288' \
rtk bash scripts/build.sh
```

镜像构建只在容器内 Next 编译、TypeScript、镜像导出和 provenance 全部成功时成立。构建完成后记录 tar SHA-256，并核对 provenance 中的 `appRevision`、`runtimeSourceRevision`、`indexSourceRevision`、runtime/index digest；任何 revision 混合或旧 tar 复用都应 fail closed。

4. 远端部署
```bash
rtk bash scripts/remote-deploy.sh --skip-build
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
- runner 镜像可以有意不包含 Git。需要解析 capture revision 时，只允许 Git 可执行文件 `ENOENT` 回退到受信任的 `.app-revision`；其他 Git 错误、revision 不一致或脏捕获证据仍须失败
- 大型 Canonical inventory 的首次持久化可能超过 Prisma 默认 5 秒 interactive transaction timeout；使用仓库当前限定于该事务的 30 秒超时，不要扩大为全局事务默认值
- 远端 shell 程序若由单引号包裹，不得再嵌套单引号 grep pattern；部署前运行静态脚本测试，避免 quoting 错误在切换期间才出现

5. 远端验收
```bash
rtk ssh root@121.40.124.135 "podman ps -a --format 'table {{.Names}}\t{{.Status}}' | grep act-obe"
rtk ssh root@121.40.124.135 "systemctl --no-pager --full status act-obe-stack.service | sed -n '1,80p'"
rtk ssh root@121.40.124.135 "podman exec act-obe-redis redis-cli CONFIG GET maxmemory-policy"
rtk ssh root@121.40.124.135 "podman exec act-obe-redis redis-cli --scan --pattern 'bull:*' | head -n 40"
rtk ssh root@121.40.124.135 "podman exec act-obe-app /bin/sh -lc 'getent hosts act-obe-postgres.dns.podman act-obe-redis.dns.podman; printenv DATABASE_URL REDIS_URL POSTGRES_HOST || true'"
rtk ssh root@121.40.124.135 "curl -k -I -s https://act.adapt-learn.online/"
rtk ssh root@121.40.124.135 "curl -k -s https://act.adapt-learn.online/api/auth/session"
rtk ssh root@121.40.124.135 "curl -k -s https://act.adapt-learn.online/api/readyz"
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
- 容器内 runtime 文件为 `0644` 仍不足以证明可读；必须确认从 runtime 根到叶目录均允许容器用户遍历，例如 `find /home/projects/act/course-content/runtime -type d ! -perm -0005 -print -quit` 无输出，并在容器内实际读取 runtime 与索引
- 图谱发布需同时报告迁移数量、导入/verify-only 结果、Shadow inventory 计数、`cutoverReady` 和当前 authority；`LEGACY` authority 下 Shadow 导入成功不代表已切换
- 若为了验证脚本多次连续执行 `remote-deploy.sh --skip-build` 后触发 Podman/runc 级别异常，例如 `unable to freeze` 或 worker 停在 `Created`，优先做最小恢复：
  - 先确认 `readyz` 是否仍为 `app=true, db=true, redis=true`
  - 若仅 `worker` 未运行，优先 `podman start act-obe-worker`，不要直接再次全量重部署
- 在 RTK 包装环境中，部署脚本内的 Node command substitution 或 SSH 远端脚本传输不得使用 heredoc（例如 `node - <<'NODE'`、`ssh ... <<'REMOTE'`）；其 heredoc 写入可能阻塞而尚未执行远端步骤。小型本地 OCI 元数据解析改用 `node -e '<program>' -- <arg>`；远端多行操作器以版本化本地脚本通过标准输入传输，并以静态回归测试禁止恢复 heredoc。

6. 本地收尾并释放 Docker Desktop 内存

先确认发布构建及其他获授权构建均已结束；BuildKit 容器中的常驻 `buildkitd` 或单一 `dial-stdio` 控制通道不等价于正在构建，判断时以宿主机 `docker build`、`docker buildx build`、`buildctl build` 或 `scripts/build.sh` 进程和 BuildKit 日志为准。

```bash
rtk proxy ps -Ao pid,ppid,etime,command | rtk rg '[d]ocker (build|buildx build)|[b]ash scripts/build\.sh|[b]uildctl build'
rtk docker logs --since 5m buildx_buildkit_codex-release0
rtk proxy osascript -e 'quit app "Docker"'
```

退出后确认 Docker Desktop 进程和 VM 已结束、`docker info` 不再可用。若仍有用户明确要求继续的本地构建，等待该构建自然完成后再退出；不得以释放内存为由中断它。退出 Docker Desktop 会停止本地 Redis、Neo4j 等验证容器，这是发布收尾的预期结果；下一次验证前重新启动 Docker Desktop 并核对所需容器状态。

## 最近发布经验摘要

- 先把“镜像构建成功”“远端装载成功”“应用运行”“权威数据验证”“authority cutover”作为五个独立门禁，不能用前一项替代后一项
- `podman load` 后核对实际镜像 ID、完整 OCI revision 和 app/worker 使用的 tag；registry 前缀差异可能让服务继续运行旧镜像
- 生产失败优先保持或恢复上一可用 authority 与服务，再修复发布链；不要在服务已恢复后反复全量执行部署脚本制造 Podman/runc 状态问题
- 原子发布目录必须规范化目录遍历权限；文件可读但父目录为 `0700` 时，非 root 容器用户仍会得到 `Permission denied`
- 远端数据库迁移、Canonical Shadow import 和权威知识 verify-only 都要在最终镜像启动后再次执行；本地测试只证明候选可部署，不证明生产路径成立
- 删除远端旧镜像或 tar 前确认本地仍保留可校验归档；清理动作与回滚能力必须同时报告
- 容量预检必须发生在停止 runtime 消费者之前：把本地 tar 实际大小、`docker image inspect .Size`、远端可用空间和数据库备份余量同表核对。经验下限为 `tar + image + 1 GiB`；不足时先清理已核验且本地仍有归档的历史 runtime 备份或传输工件。`podman system df` 的 reclaimable 值异常、或残留 `working-container` 时，不得把它视为可用空间；以 `df -B1 /` 为准，并额外核对 `podman ps --external`。
- 若 `podman load` 因空间耗尽已停止 app/worker，先以仍存在的直接前驱镜像显式执行 `APP_IMAGE=<previous> /home/projects/act/scripts/4-deploy.sh --app-only` 恢复服务，并通过 `readyz` 后再清理和重试；旧服务未恢复前不得重复全量部署。
