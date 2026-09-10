# ACT Runtime OSS 迁移操作手册

本手册约束 `course-content/runtime` 的第一阶段迁移：runtime 以不可变 Release 存储于私有 OSS，ECS 通过 ossfs 2.0 的只读挂载继续提供既有 Node `fs` 路径。它不授权 Bucket 配置变更、生产切换或删除旧数据。

## 当前基线

- 生产主机根分区为 ext4，容量 52,447,014,912 bytes，已用 45,127,794,688 bytes（91%），可用 4,957,241,344 bytes。
- 本地 runtime 的已分配空间为 5,949,075,456 bytes，10,222 个文件；`lessons`、`knowledge`、`resources` 分别约 3.33 GB、1.40 GB、0.99 GB。Podman images 报告为 15.37GB，其中 2.379GB 可回收，故 runtime 迁移不能被表述为唯一磁盘根因。
- Phase 0 采集时，ECS RAM Role metadata endpoint 返回 404，且尚未安装 `ossfs2`、`ossfs`、`ossutil`。截至 2026-08-13，ECS 已安装 `ossutil` 1.7.19 与 ossfs 2.0.8，并绑定 `act-runtime-oss-release-operator-ecs`。发布 bridge 只接受该 IMDS 身份且不使用永久凭据；ossfs 与 Podman runtime bind 继续只读。
- 机器可读的只读采集结果见 [Phase 0 disk report](../../artifacts/runtime-release/phase-0-production-disk-report-20260811.json)。主工作树 source revision `6ffb506f0334014df5a8304fbbd7ff54c1054e4f` 的媒体盘点见 [media inventory](../../artifacts/runtime-release/phase-0-main-runtime-media-inventory-6ffb506f.json)：121 项声明资源中，96 项 runtime 本地存在、101 项 authoring processed 存在、90 项有 legacy URL、19 项 unresolved。

首次本地 retrieval 基准只代表主工作树源盘，不代表 ossfs：`vectors.f32`、`bodies.utf8`、`lexical-postings.bin` 的结果见 [baseline](../../artifacts/runtime-release/phase-0-main-textbook-retrieval-baseline-6ffb506f.json)。候选 ossfs 挂载必须使用同一工具重新测量后才能决定是否启用热缓存。

## 未使用 OSS 对象退役

生产切到 v2 blob-view 后，Bucket 里仍可能留下完整的 v1 前缀树，以及不再被 `current`/`previous` 引用的 release 目录。退役只允许走显式 `npm run runtime:gc`：

- 默认 dry-run，只报告可移除的 release，不删除。
- 保护集是 `current`、`previous`、仍被 ClassSession 引用的 release，以及人工 `--pin`。
- `--execute` 只移除未被保护的 release 视图与 `runtime/blob-releases/<id>` 目录；永不删除 `runtime/blobs/sha256/<sha>`。
- 全量 Blob 存在性与哈希审计属于 `npm run runtime:doctor -- --full`，不得挂到 publish/activate 或应用部署。

## 当前生产部署合同

生产已切到 v2 `ossfs-blob-view`。应用容器只读 bind 已物化 view，不再从 ECS 本地 `course-content/runtime` 提供课程内容。

- `npm run deploy:app`（`scripts/remote-deploy.sh --app-only`）只构建/上传/装载应用镜像，并绑定当前 blob-view。
- `npm run runtime:publish` 把工作树变化写入 OSS CAS 与不可变 v2 manifest；`npm run runtime:activate` 再切换宿主机 `current`/`previous`。二者都不得 rsync 完整 runtime，也不得构建镜像或改数据库。
- 应用与 Runtime 都变时按上述顺序分别执行；已删除 `deploy:runtime` 与 `deploy:all`。
- `deploy/podman/deploy.sh`（远端 `4-deploy.sh`）默认 `RUNTIME_DELIVERY_MODE=ossfs-blob-view`，只 bind 现有 view 与 helper FUSE；view 缺失时失败关闭。
- `remote-deploy.sh` 默认同样是 `ossfs-blob-view`，不会把本地 `course-content/runtime` rsync 到服务器。`legacy-rsync` 已退役；更新 runtime 只能使用 `runtime:publish` 与 `runtime:activate`。
- v1 `ossfs-release` 命令仅用于历史 prefix release，不是日常路径。

## 身份与权限

Bucket `act-course-assets` 必须保持私有、阻止公共访问、标准存储与 SSE-OSS。不得将 AccessKey、Secret、STS token 或签名 URL 写入仓库、`.env`、脚本、manifest 或日志。

合作者开发接入经生产 ECS 上的激活 runtime 只读网关，使用仓库外共享网关令牌按需读取签发时的 host-active v2 Release。开发浏览器不直连杭州公网 OSS，也不使用 `act-runtime-dev-read` AccessKey。同一 Linux 运行层上的多个 worktree 共享一份只读网关 Blob 适配器与磁盘缓存，Release pin 与租约仍按 checkout 独立。它不是 Publisher，也不是 ECS `act-runtime-oss-read`，也不能 SSH。接入说明见 [developer-oss-runtime-access.md](developer-oss-runtime-access.md)，共享缓存见 [developer-oss-shared-cache.md](developer-oss-shared-cache.md)，令牌签发/撤销见 [developer-oss-runtime-ram-setup.md](developer-oss-runtime-ram-setup.md)。开发启动走 `npm run startup:oss-runtime`，不要把令牌写入 `.env`。

ECS 使用用户创建的受限服务角色 `act-runtime-oss-release-operator-ecs`。它的对象策略仅覆盖 `runtime/` 前缀；bridge 在 IMDS 中精确匹配该角色并以不可变 publish/verify 协议控制写入。应用仍只经只读 ossfs bind 读取 runtime，短时媒体签名不向浏览器暴露永久 Bucket URL。删除能力只可由后续独立、审查过的回收适配器在精确退役前缀上使用；当前 v2 GC 仅演练本地 mirror，不会删除 OSS 对象。

角色绑定完成后，先从 ECS 只读确认 metadata endpoint 返回角色名，再验证 role 对目标 Bucket/prefix 的最小读取能力。不要以长期 AK 作为替代方案。

### 长期身份分离（待当前 ECS 导入完成后实施）

生产读取与运行态维护是两个独立职责。生产 ECS 应长期只绑定 `act-runtime-oss-read`：ossfs、应用容器和服务端媒体签名只使用该只读身份。`act-runtime-oss-release-operator-ecs` 仅用于已经在 ECS 上执行的受控迁移或恢复任务；在这类任务结束并完成验证后，应从实例解绑，不作为生产常驻权限。

普通 RAM 角色 `act-runtime-oss-release-operator` 预留为本机或受控 CI 的维护目标角色。它只允许在 `runtime/blobs/sha256/*`、`runtime/blob-releases/*` 与明确批准的发布来源前缀内执行发布、校验和经审查的回收操作；它不授予 Bucket 级管理、生产 selector、ossfs 配置、容器或数据库权限。该角色的信任策略应限定到专用本机维护身份，例如 `act-runtime-maintainer` RAM 用户或企业 SSO/OIDC 身份；维护身份自身只拥有对该一个角色的 `sts:AssumeRole` 权限。

本机维护必须通过浏览器 OAuth、CloudSSO 或 OIDC 获取短期凭证后再 AssumeRole；不得把长期 AccessKey、Secret、STS token 写入仓库、`.env`、脚本、manifest 或日志。日常发布已是本机 `runtime:publish`：用 ossutil 条件 PUT 写入 CAS blob，最后写不可变 manifest。不得以 `ossutil sync` 或普通对象覆盖取代该协议。ECS IMDS 的 `act-runtime-oss-release-operator-ecs` 仍只服务只读挂载、物化与恢复，不作为日常发布编排。

创建本机维护身份、收窄普通 operator 角色的信任策略以及配置本机短期认证，均不改变正在运行的 ECS 导入。导入期间不得变更 ECS 实例绑定、`act-runtime-oss-release-operator-ecs` 的有效权限或 ossfs 配置；也不得让本机维护通道与 ECS 导入并发执行发布、导入或回收写操作。仅在当前导入产生终止 manifest、远端复核通过并释放其发布锁后，才可启用本机写入通道。

## 发布、验证与检查

日常 v2 发布扫描本机 `course-content/runtime` 工作树。本地 SQLite 索引记录 path/size/mtime_ns/sha256；只对 metadata 变化的文件计算哈希，再对新增内容做条件 PUT。`sourceRevision` 默认写入 `git rev-parse HEAD`，只作 provenance。索引缺失必须显式 `--bootstrap`，不得静默全量。凭据仍只来自本机受管 provider，不得写入仓库。

```bash
npm run runtime:publish -- --oss-bucket act-course-assets
# 索引缺失时：
npm run runtime:publish -- --oss-bucket act-course-assets --bootstrap

npm run runtime:activate -- \
  --store-dir <store> \
  --state-dir /home/projects/act/data/runtime/blob-views \
  --release-id <release-id> \
  --smoke '<candidate-view readiness command>' \
  --reload-consumers 'bash /home/projects/act/scripts/4-deploy.sh --runtime-cutover-app-only'

npm run runtime:rollback -- --store-dir <store> --state-dir /home/projects/act/data/runtime/blob-views
npm run runtime:doctor -- --store-dir <store> --state-dir /home/projects/act/data/runtime/blob-views --full
npm run runtime:gc -- --store-dir <store> --state-dir /home/projects/act/data/runtime/blob-views
```

`runtime:publish` 不激活。激活只比较 current manifest 的 Δ 路径、确认这些 Blob 可见、检查固定 sentinel，对候选视图跑 runtime smoke，然后原子切换 `blob-views/current`（以及 `live` 别名）与 `previous`。生产 `--state-dir` 必须是 `data/runtime/blob-views`：Podman 绑定的是该目录下的 `current` 符号链接，不是 `live`。物化视图必须写出 `.act-runtime-release.v2.json`、`.act-runtime-release-materialization.v1.json` 和真实目录 `.act-runtime-blobs`（供 helper bind，不得假冒 FUSE）。`blob-views` 上激活若未提供 `--smoke` / `ACT_RUNTIME_SMOKE` 会失败关闭。Bind mount 在挂载时解析，指针切换后若消费者仍在运行，必须用 `--reload-consumers` 重建容器挂载。回滚交换两个指针，不重新上传。`runtime:doctor` 与 `runtime:gc` 不得由 publish、activate 或 `deploy:app` 隐式调用。`runtime:gc --execute` 必须能发现 `CourseBundleRevision.runtimeReleaseId`（`DATABASE_URL` + `psql`）、显式 `--session-release`，或仅在夹具中使用 `--no-session-refs`。对象键保持 `runtime/blobs/sha256/<sha256>` 与 `runtime/blob-releases/<releaseId>/manifest.json`。

## 2026-08-11 实际候选证据

首个完整 Release 为 `runtime-b2f0b07c428faba4317bf2f5b7ad51f0858165dee8651fcea52eb6a`，绑定 source revision `3097ebc204d65b2722cfdc1423e0d1646e37d55d`、10,222 个文件、5,924,691,879 bytes、tree SHA-256 `2fd9eec21142994ea97bf971225b1ad24a85ee6346ec17d8ff96d2da93708133`、semantic manifest SHA-256 `75912510df1f3e9b89801702dea9747ce15e0af117317886dabc9965b760f326` 与 wire SHA-256 `fc6ead8721b950731a866d652a01020ea5626b741c06af98f4264891d13ed88f`。

- 当时的 `act-runtime-oss-read` 经 ECS IMDS 确认后，重新读取 OSS manifest 并精确匹配 wire SHA-256；该历史 v1 证据不构成新 operator 角色或 v2 candidate 的验证。
- Release 挂载在独立候选路径 `/home/projects/act/data/runtime/ossfs/releases/<release-id>`；`findmnt` 证明为 FUSE 且 `ro`，未创建 `act-runtime-selection.json` 或 `act-runtime-active-receipt.json`。
- `verify-mounted` 对候选目录完成逐文件文件集、size 与 SHA-256 复核，结果为 10,222 个文件和 5,924,691,879 bytes。
- 无网络临时 Node 容器以 `/app/course-content/runtime:ro` bind mount 读取 `vectors.f32`，并确认写入返回 `EROFS`。
- 三次完整读取并 SHA-256 校验的候选基准：`vectors.f32`（54,444,032 bytes）190.441 / 194.310 / 198.389 ms；`bodies.utf8`（46,759,868 bytes）163.649 / 177.434 / 165.487 ms；`lexical-postings.bin`（8,747,083 bytes）35.434 / 29.876 / 32.942 ms。没有可重复的明显退化证据，因此未启用本地 hot cache。
- 候选回退演练停止并重新启动该候选 ossfs unit；现有应用继续从 legacy runtime 只读 bind mount 运行且 `/api/readyz` 正常，selector 与 active receipt 均保持缺席。

## 候选挂载与切换清单

1. 确认 ECS 绑定 runtime RAM Role，并安装 ossfs 2.0。配置使用 `oss-cn-hangzhou-internal.aliyuncs.com`、`oss_bucket_prefix=runtime/releases/<release-id>/`、`--ro=true` 与显式 uid/gid/file/dir mode。
2. 发布器的逐对象 upload/readback receipt 是完整内容完整性证明。以 ECS 当前 operator role 读取并严格解析 manifest、精确比对 OSS object key 集合，并读取代表性发布媒体；不为每次切换再次读取整个 Release。将 receipt 和 host tools 同步到 ECS。禁止将 runtime 内容 rsync 到 `.staging`、`current` 或 `previous`。
3. 在候选挂载上运行：manifest、精确文件集合、全部 size 元数据与有上限的代表性内容校验、FUSE/read-only 检查、课程资源 smoke、媒体 `/api/course-runtime/assets/...` 短时重定向、`benchmark-textbook-retrieval.ts`。
4. 只有所有候选证据合格，才以显式模式调用部署。日常生产使用 blob-view，不要再走 rsync 或把 `ossfs-release` 当作默认：

```bash
# 应用镜像
npm run deploy:app -- --skip-build

# runtime 内容
npm run runtime:publish -- --oss-bucket act-course-assets
npm run runtime:activate -- --store-dir <store> --state-dir /home/projects/act/data/runtime/blob-views --release-id <release-id> --smoke '<candidate-view readiness command>'
```

宿主机只保留 `current` 与 `previous`。OSS 不使用可变 `current.json`：OSS PutObject 不提供可依赖的 CAS 语义。

## 回退与热缓存

回退交换宿主机 `current` 与 `previous`，不重新上传：

```bash
npm run runtime:rollback -- --store-dir <store> --state-dir /home/projects/act/data/runtime/blob-views
```

候选挂载如果造成 retrieval 明显、可重复的读取退化，可运行 `stage-textbook-retrieval-hot-cache.ts`。它只复制三项热索引，目录以 manifest SHA-256 命名并逐文件校验；未出现候选性能回归时不得启用该缓存。

## 删除前的人工确认点

删除旧 ECS runtime 必须在 `runtime:activate` 成功、app 将当前 Release 的只读 ossfs 路径唯一 bind 到 `/app/course-content/runtime`，且最多只有同一 Release 的 `knowledge/projection` 只读子路径 bind、app/worker 都不再持有 legacy runtime 或其子路径的 bind、worker 不持有 runtime、Authority 或 Teaching Projection 的文件系统 bind、`readyz` 正常、`previous` Release 仍可挂载之后，再由人工确认执行。它只删除精确 legacy runtime 目录，保留 OSS 中的新旧 Release 与宿主机指针。未引用的 release 目录走 `runtime:gc`；Blob 默认保留。

预期可释放的上限是当前 runtime 已分配空间约 5.95GB；实际释放量受文件系统块、仍保留的热缓存和旧目录状态影响。

未解决风险：生产容器尚未以该候选 Release 启动，因而 application-level 课程路由与媒体短时 redirect 仍须在实际切换事务中验证；19 项媒体输入仍 unresolved。旧 ECS runtime 的删除继续等待生产 smoke、可回退 Release 与人工确认。

## v2 Blob Release 候选流程（历史，生产已切过）

v2 将相同 SHA-256 内容存为 `runtime/blobs/sha256/<sha256>`，每个逻辑 Release 保留不可变 `manifest.json`。生产已使用该对象键；日常不再走 `act-runtime-release.ts`、SSH publisher bridge、lifecycle 或 `materialize-runtime-blob-release.py`。现行入口见上文「发布、验证与检查」。

历史候选清单只用于理解当时的第一次导入，不得当作现行命令：当时要求从冻结 Git tree 读 blob、SSH 条件写入、独立 lifecycle/journal，以及本地 mirror 上的 GC dry-run。这些控制面脚本已删除。

## 知识图谱根入口 404（coverage 收据缺失）恢复路径（#1942）

症状：已登录用户访问 `/knowledge` 显示「知识数据尚未发布完成」（2026-09-04 之前为「当前知识图谱暂时无法加载」），根分片 API 返回 404 `ACTIVE_SHARD_SHARD_ABSENT`。

根因：blob 视图中激活的 `knowledge/authority-domain-shards` 分片集是 #1738 之前的物化产物，缺少密封 `coverage.json` 收据；根入口 `loadRootShardWithCoverage` 按规格 fail-closed。不得放松该门禁，也不得在视图中手工补写 `coverage.json`——收据必须与分片集同一次物化产生并计入 manifest 封印。

恢复路径：

1. 目标身份以 composite registry 的 v0.37 条目为唯一真源（shard set、catalog、activation 五元组），不接受手工拼装。
2. 以包含目标分片集的工作树运行 `runtime:publish` 再 `runtime:activate`；或由 cutover 控制面脚本在同一事务内上传分片集 blob、写入 `sets/<shard-set-id>/` 链接并切换 `knowledge/authority-domain-shards/current.json` 指针。知识 cutover 只能调用新的 activate/rollback，不得恢复已删除的 Runtime lifecycle。
3. 切换后核验：根分片 API 返回 200；容器日志不再出现 locale-qualification historical fallback 警告；`/knowledge` 已登录视觉验收通过。

英文切换伴随条件：运行时镜像必须打包 `course-content/authoring/knowledge/cutover/envelopes/locale-manifests/`（Dockerfile 与 `.dockerignore` 同时放行，#1942 已修）；资格包内的 `interfaceCatalogDigest` 绑定编译期文案目录，新增界面文案键后必须用 `scripts/knowledge-cutover/build-v037-r5-locale-qualification.ts` 重封资格包。
