---
name: server-ops
description: 部署本项目，或执行必须访问远端服务器的诊断与运维。
---

# Server Ops

## Overview

这个 skill 只用于本仓库明确涉及远端服务器的操作，覆盖服务器发布与部署、远端调查、生产运行态验收、远端数据库同步和线上测试账号核对。

主入口只保留总览。遇到具体工作流时，优先打开对应参考文件，不要把所有操作混在同一条线里执行。

## Trigger Gate

只有满足以下至少一项时才允许启用本 skill：

- 用户明确要求把本项目发布或部署到服务器、生产环境或线上环境。
- 当前任务必须通过 SSH 或等价远端接口读取、诊断或修改服务器状态，例如容器、systemd、Nginx、远端日志、远端环境变量、远端数据库或线上账号。

以下任务一概不得触发本 skill：

- 本地代码、数据、迁移、构建或测试工作，且用户没有要求部署到服务器。
- Git、GitHub、ActKG 或其他仓库中的 Release、tag、Bundle、图谱发布核对。
- 仅基于本地仓库、发布工件、Issue、OpenSpec 或数据库快照分析图谱 authority、cutover readiness、CourseCoverage 或迁移条件。
- 任何不需要读取或改变远端服务器状态的“发布”“切换”“上线准备”讨论。

语义存在歧义时默认不启用；不得因为任务出现“发布”“生产”“图谱切换”或“运行时”等词就推断为服务器操作。

## Hard Constraints

- 部署模式固定为“本机构建镜像或镜像包，再在远端执行装载与启停”；不得改为远端源码构建、远端常驻代码目录构建或任何临时改变部署模式的做法。
- 本地镜像打包必须使用本机 Docker 守护进程执行 `scripts/build.sh` 中的 `docker buildx build`；若 Docker 未运行，应先启动 Docker 并验证 `docker info`，不得擅自切换到 Colima、Podman、Lima 或其他构建运行时，也不得用旧镜像包替代本次构建。
- 发布构建固定使用 Docker Desktop 24 GiB 内存、8 GiB Swap 和 `NODE_MAX_OLD_SPACE_SIZE=12288`；`docker info --format '{{.MemTotal}}'` 低于 20 GiB 时必须停止，不能在不足内存的 VM 中反复降低或试探 Node heap。
- 当前构建必须自然结束后才能重启或退出 Docker Desktop；远端部署及最终验收完成、确认没有其他获授权的本地构建后，必须退出 Docker Desktop 释放 VM 内存，不能只停止 builder 容器。
- 远端 `/home/projects/act` 只允许保留运维脚本、环境变量文件，以及已物化的 OSS runtime view（`data/runtime/blob-views` 与只读 ossfs helper）。不得把本地 `course-content/runtime` 作为部署内容 rsync 到服务器，也不得上传业务源码、测试、文档、记忆文件或其他代码目录。
- 禁止在远端执行 `podman build`、`docker build`、`npm run build`、`next build` 或任何等价的源码构建命令。
- 若发现远端源码残留，记录其路径和用途；仅在明确授权清理且已确认可恢复性后删除，不把只读调查自动扩展为清理。
- 若需要更新部署逻辑，只能修改本地仓库中的运维脚本与文档，并通过既定的本机构建流程产出镜像，再按既定方式部署。

## 校内双镜像（campus mirror）

用户要求"部署"时，默认指双镜像同步：阿里云 `121.40.124.135` 与校内 `202.195.195.153`（`act.just.edu.cn`）承载同一份应用镜像与数据（2026-11 起）。

- 校内网络事实（2026-11-04 实测）：出站 TCP 全禁（dnf 在线更新、ossfs、直读 OSS 均不可用）；阿里云→校内 22/443 同样被拦；校内 22/80/443 仅校园网内来源可达。镜像 tar、数据库 dump、runtime 物化包都只能"阿里云 → 本机 → 校内"两跳中转，且本机须先放行 Clash 直连该 IP。
- 镜像策略：本机构建的 linux/amd64 应用镜像 tar 在两个目标都装载并核验完成前不得删除；校内用 `podman load` 装载同一份 tar，与阿里云字节一致。禁止在校内重新构建或使用另一份构建产物充当"同步"。
- runtime：校内无法直读 OSS，课程内容依赖本地物化副本。只在 `runtime:publish` 产生新 Release 后才需要同步校内，日常 `deploy:app` 不重搬 runtime。同步优先保留 blob-store + view 的链接与选择器结构（rsync 不带 `-L`，复制后核对 current 指针与 active receipt），避免每次全量解引用打包；在生产 ECS 上仍禁止增量 rematerialize。
- 数据库：按需从阿里云导出 dump 灌入校内，灌入前后校验行数与关键选择器表；两端的运行态差异（OSS 直读 vs 本地物化）必须体现在各自 `.env` 与只读挂载配置中。
- 校内 HTTPS 由 nginx 终结（80→443 301），应用容器端口由校内 nginx 反代，不重复占用 80/443。证书用学校统一通配符 `*.just.edu.cn`（源文件 `~/Documents/Site/20251218 - 江苏科技大学star.just.edu.cn/Nginx/`，key 无密码，2026-12 到期需向学校换发）；Let's Encrypt 版保留 `/etc/nginx/ssl/` 作备用，续期钩子在 `~/Documents/Scripts/certbot-just/`。
- 校内首次克隆（2026-11-04）允许一次性解引用快照；之后每次 runtime 发布的校内同步必须走增量结构复制。

### 首次克隆踩坑记录（2026-11-04/05，复现过、已定案）

- **校内部署模式必须是 `./deploy.sh --runtime-cutover-app-only`**（与 remote-deploy 调用生产同款）。`--app-only`/`--all` 会先跑一个"执行 Prisma 迁移"的 `podman run --rm --entrypoint ./docker-entrypoint.sh` 一次性容器，它**不挂载 runtime 目录**，entrypoint 序列读到 `/app/course-content/runtime/resource-governance/runtime-resource-projections.jsonl` 时必然 ENOENT——该报错伪装成挂载/数据问题，极易误导向 bind mount 排查。用 `bash -x` 抓完整 podman run 命令即可定位此类"日志来自哪个容器"的迷惑。
- **校内 runtime 内容源 = 本机 `course-content/runtime`**：发布工作树与生产 active Release 字节一致（首次克隆已用三对文件 md5 抽查验证：28M projections.jsonl、knowledge/projection/current.json、课程媒体）。直传用 `tar -C course-content/runtime -cf - knowledge resource-governance lessons resources | ssh 校内 "tar -xf - -C materialized-runtime/"`，校园网内 ~60MB/s（7.3G 约 2 分钟）。`hot-index/knowledge/projection` 在校内从树内 `cp -a` 重建；`act-runtime-active-receipt.json` 等状态 json 从生产按小文件补。
- **OSS view 产物几乎都是符号链接**（指向 `.act-runtime-blobs/sha256/...`）：从 ECS blob-views 打包/复制必须解引用（`tar -h` / `cp -L` / `rsync -L`），否则传到校内是一堆断链且体积异常小（一次 105 文件的目录只传出 12K）。`.act-runtime-blobs` 是全量 CAS 历史池（>15G），物化/同步时必须 `--exclude` 它，只取目录树引用的实体。ossfs 挂载上避免整目录 `du`/`find`（遍历 OSS 会超时）。
- **`deploy/images/act-obe.tar` 是 app-image-bundle.v1 两层格式**（app-rootfs.tar.gz + meta，需 `scripts/release/assemble-app-image.mjs` + runner-os tar 组装），**不能直接 `podman load`**。完整镜像的 docker-archive 导出层未压缩（~4G，`gzip -1` 后 ~1.4G）。自 2026-11 起校内镜像改为本机构建后双端 load 同一份 tar，此导出路径仅为历史参考。
- **传输路径与带宽**：大文件一律"本机→校内"直传（校园网 ~60MB/s）；"阿里云→本机"单流仅 ~0.4-2.5MB/s 且长连接易被代理中断（Clash TUN 接管但 mihomo 规则 DIRECT 时绕节点），并发多流无增益（出口带宽瓶颈），只用于 KB-MB 级小文件。多任务并行 scp 会产生半截文件竞争同一路径，传输后必须三点 md5 校验。
- **校内容器化后的固化事实**：act 应用占 `act.just.edu.cn` 根路径，原门户静态页归档 `/legacy/`，shiptalk 容器已停用（保留可恢复）；`SKIP_WOLFRAM_READY_CHECK=1` 是校内常态（出网禁，Wolfram/AI 外呼不可达）；`MATH_DOCUMENT_GRADING_WORKER_REQUIRED=false` 与生产一致。

## 发布分支流程

- 按本次已授权发布范围选择 `origin/main` 提交；只有本次发布明确包含集成变更时，才在冻结前将该范围合入 `main`，不自动追入其他提交。
- 部署过程中如果在 `main` 中进行了修改（如版本号提升、发布 hotfix），需要将修改同步到集成分支 `integration`。
- 部署完成后回到集成分支 `integration`。

## When to Use

- 用户明确要求将本项目发布或部署到服务器
- 应用部署默认双镜像同步：阿里云 `121.40.124.135` 与校内 `202.195.195.153`（`act.just.edu.cn`，见「校内双镜像」一节）
- 需要 SSH 到 `121.40.124.135` 调查线上问题
- 需要核对 Podman 容器、systemd、Nginx、环境变量
- 需要重新部署并验证 `app + postgres + redis + worker + scheduler`
- 需要把远端数据库导出并同步到本地分析
- 需要核对或修复线上测试账号

## References

- 远端调查与故障排查: `references/remote-investigation.md`
- 课堂同步错误与 `Failed to fetch` 根因分流: `references/classroom-sync-errors.md`
- 部署与验收: `references/deploy-and-verify.md`
- OSS 不可变运行时发布与 ossfs 兼容挂载: `references/oss-runtime-releases.md`
- 私有 OSS 经 ESA 分发版本化仿真模型: `references/oss-esa-model-delivery.md`（仅当任务涉及 `act-course-models`、`static.adapt-learn.online`、GLB/贴图加载、ESA 缓存或模型发布验收时读取；它不替代 Runtime 发布流程）
- 数据库导出/下载/本地恢复: `references/database-sync.md`
- 测试账号核对与修复: `references/test-accounts.md`
- 部署期磁盘清理辅助脚本（孤儿 overlay 层扫描 / `layers.json` 元数据联动修复）: `scripts/overlay-orphan-scan.py`、`scripts/fix-stale-layer-records.py`，用法见 `references/remote-investigation.md` 的“部署期磁盘耗尽”一节

## Operating Rules

- 先确认当前环境：本地开发、远端生产，还是两边联动
- 先做只读检查，再执行变更
- 构建或发布命令需要管道收窄输出时，必须先 `set -o pipefail` 并回显真实 EXIT，不得以 `tail`/`tee` 的退出码判断发布成败（约束细节见 `references/deploy-and-verify.md`）
- 若问题表现为课堂中 `同步错误`、`fail to fetch`、学生端不跟随教师进度、教师端无法推进步骤或 reveal/release 状态不同步，先读 `references/classroom-sync-errors.md`
- 涉及部署时，先确认本次操作是否符合“本机构建、远端仅装载镜像”的固定模式；若不符合，立即停止
- 远端目录若需要整理，只保留 `scripts/`、`deploy/podman/`、`.env*`、`data/runtime/act-obe.env` 与已物化的 OSS blob-view；不要恢复或同步一份本地 `course-content/runtime` 作为部署内容
- 应用部署使用 `npm run deploy:app`（`remote-deploy.sh --app-only`），只更新镜像并绑定当前 blob-view；Runtime 发布使用 `npm run runtime:publish`，只有激活也明确获授权时才运行 `npm run runtime:activate`。已删除 `deploy:runtime` 与 `deploy:all`。`legacy-rsync` 已退役，不得再同步本地 `course-content/runtime`
- 涉及数据库覆盖导入时，先做本地备份
- 涉及远端服务重启时，保留前后状态与关键日志
- 验收至少覆盖容器状态、核心接口、关键环境变量和日志摘要
- 涉及 OSS 运行时迁移时，先读 `references/oss-runtime-releases.md`；只有完成 RAM Role、不可变 Release、远端复核、只读挂载和回滚证据后，才能变更运行时选择记录
- 当且仅当任务已经满足 Trigger Gate 且服务器部署包含图谱或权威数据变化时，必须先在本地验证迁移、导入与 revision/provenance 闭合；Candidate、Shadow 与 Legacy 可以并存，除非用户明确授权且 cutover gate 通过，不得把服务器部署等同于 authority cutover
- 已提交的 production cutover marker 存在时，普通 Legacy `remote-deploy.sh` 必须保持禁用；后续更新只能使用 cutover-aware 事务或显式 rollback，不得用常规部署重试覆盖 selector 状态
- 生产**应用代码**发布与部署的唯一代码基线是一个已经进入 `origin/main` 的完整 Git commit。用户要求“部署”或“发布”时，先 fetch `origin/main`，冻结该 commit 与应用发布版本；如果当次需要把 `integration` 合入 `main`，合并必须在冻结前完成。冻结后不得读取、等待、比较或因 `integration` 的后续变化阻塞该次应用发布。
- 每次生产应用发布必须有新的、明确的版本号，并同时写入镜像标签、应用工件/provenance 与最终发布回执。完整 `main` SHA 是代码内容身份，不能替代面向运维和回滚的应用发布版本号。
- Runtime、图谱、索引等运行时发布与应用代码是两条独立版本线。`runtime:publish` 读取工作树字节，把 Git SHA 只写入 provenance；不要求与已发布应用的 `main` SHA 相同，也不再核验兼容性收据。Runtime 发布不得重建、替换或回退应用镜像。
- `runtime:publish` 只决定哪些字节进入 OSS；`runtime:activate` 只切换宿主机 `current`/`previous`。内容正确性在作者态/CI 完成；存储完整性靠 CAS 与显式 `runtime:doctor`，日常发布不得全量重读未改文件。
- 应用操作以 `origin/main` 的完整 SHA 和新应用发布版本为不可变起点。任一侧发布后都不得把另一次无关变更追进当次操作。
