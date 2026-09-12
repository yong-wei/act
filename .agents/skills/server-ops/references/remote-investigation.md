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

## 部署期磁盘耗尽（podman 装载失败）

症状：`remote-deploy.sh` 在远端 Step 2/7 装载镜像阶段失败，报错为 `no space left on device`（写入 `/var/tmp/container_images_*` 或 overlay 层内文件），或 SSH 在装载中途被远端断开（磁盘写满时 sshd 连带受影响）。

关键事实（2026-09-04 v0.7.2 部署实证）：

- 远端 `scripts/2-load-images.sh` 会装载 `images/` 目录下**全部** `.tar`，不只是本次目标镜像。已删除的旧镜像若有 tar 残留会被重新载回，白吃磁盘。部署前保持该目录只含目标 tar；旧版本 tar 本地均有副本，需要时可重传。
- `podman load` 峰值空间约为镜像的 2 倍：OCI 暂存先落 `/var/tmp`（约等于压缩 tar 体积），再解压写入 `/var/lib/containers/storage/overlay`。中断的装载会在 `/var/tmp` 留下数 GB 暂存残余（`container_images_oci*` / `container_images_storage*`），可直接删除。
- 不同构建机/时间产出的镜像层几乎不共享（v0.7.1→v0.7.2 有 44/51 层哈希不同），不要用"只差一个应用层"估计空间需求；精确方法是在本地对比两个 tar 的 `manifest.json` 层列表。

排查顺序：

1. `df -h /`；`du -sh /var/tmp/*`、`du -sh /var/lib/containers/storage/*`。
2. `podman system df` 的 Images SIZE 与 `overlay/` 实际体积可能相差很大（共享层记账），差异部分主要是中断装载留下的孤儿层。
3. 孤儿层清理必须用 `scripts/overlay-orphan-scan.py`（stdin 传远端 `python3 -`，远端为 Python 3.6）：先 dry-run 确认 `live_layers + orphans == overlay_dirs` 且无 `live layers missing` 告警，再 `--delete`。**不能只删目录**：中断装载在 `overlay-layers/layers.json` 里登记的层记录若失去目录，后续 `podman load` 会复用幽灵层报 `Stat .../diff: no such file or directory`；删过目录后必须用 `scripts/fix-stale-layer-records.py --write` 同步剔除元数据（自动备份 `.bak-orphan-fix` 并做父层完整性校验）。
4. 2026-09-04 起服务器云盘已从 49G 扩容到 99G，正常发布不再需要上述极限清理；但该流程仍是磁盘告警时的标准处置。

Wolfram 维护窗口部署：`SKIP_WOLFRAM_READY_CHECK=1` 放在远端 `.env.server`，生效于三处——`docker-entrypoint.sh` 启动迁移前探针、`deploy/podman/deploy.sh` 的 smoke 预检、`scripts/remote-deploy.sh` 部署验证段。Wolfram 恢复后从 `.env.server` 删除该行即恢复完整门禁，无需改代码。

## 开发者网关（runtime-dev.adapt-learn.online）读取超时

症状：合作者 `npm run startup:oss-runtime` 报“读取超时”；nginx `developer-gateway.access.log` 大量 heartbeat `499`；网关 journal 出现 `_send(204)` 的 `BrokenPipeError`（BrokenPipe 只是客户端已断开的结果，不是根因）。

排查顺序：

1. `systemctl status act-developer-runtime-gateway.service`、`top -p <pid>`、`ls /proc/<pid>/task | wc -l` 与 `cat /proc/<pid>/io`：持续高 CPU、`wchar` 达到 TB 级即指向租约持久化风暴。
2. 租约库：`ls -la /var/lib/act-runtime-developer-gateway/leases.json`。每条租约内联约 3.7 万条 allowlist（约 5MB/条）；`heartbeat` 与每次 blob GET 都曾在全局锁内全量重写该文件，文件随重试僵尸租约膨胀到数百 MB 后所有请求排队超时。
3. 挂载面排除：`timeout 8 ls /home/projects/act/data/runtime/ossfs/blobs` 正常说明 ossfs 不背锅。

修复（2026-09-04 已落地 `scripts/runtime-release/developer-oss/gateway_service.py`）：持久化前驱逐死亡与超过心跳宽限的租约；heartbeat/blob 探测的持久化按 30 秒去抖；同 checkout 重新签发时取代旧活租约。运维配套：重启服务前用同样规则裁剪 `leases.json`（先备份），不要让数百 MB 级租约库随进程重启原样复活。远端该文件必须与仓库 sha256 一致，禁止只在远端改。

常见模式：

- `P1001`：应用到 PostgreSQL 不可达
- `Digest: 1744748396`：教师首页服务端查询 `LessonPlan` 时命中数据库不可达；先查 `podman logs act-obe-app` 是否伴随 `P1001`
- `ENOTFOUND act-obe-redis`：容器内 DNS 解析/网络别名问题
- `Timed out fetching a new connection from the pool`：连接池不足
- `Cannot read properties of null (reading 'user')`：服务端路由未处理空 session

本次教师驾驶舱加固后的默认判断：

- 应用容器环境变量默认应使用 `act-obe-postgres` 与 `act-obe-redis` 这两个网络别名，不再把 `*.dns.podman` 作为默认主机名
- 若 `/api/readyz` 中 `db=false` 或 `redis=false`，先排基础连通性，再看业务页面日志，不要直接怀疑页面逻辑

## 开发者网关签发 409 与简化激活

2026-09-12：简化物化器只写所选 manifest 和物化记录，旧网关要求发布回执导致新租约 409。网关应读取 `blob-views/current/.act-runtime-release.v2.json`，客户端仅获取 manifest；不得补回旧回执门禁或因 JSON 排版改变拒收当前权威。已有心跳 204 不能证明新租约可签发。验证使用真实物化器生成的视图，覆盖无回执、过期审计回执、current 切换及旧租约继续读。传输默认 24 小时、心跳宽限 7 天。
