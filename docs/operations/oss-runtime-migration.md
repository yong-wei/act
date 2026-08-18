# ACT Runtime OSS 迁移操作手册

本手册约束 `course-content/runtime` 的第一阶段迁移：runtime 以不可变 Release 存储于私有 OSS，ECS 通过 ossfs 2.0 的只读挂载继续提供既有 Node `fs` 路径。它不授权 Bucket 配置变更、生产切换或删除旧数据。

## 当前基线

- 生产主机根分区为 ext4，容量 52,447,014,912 bytes，已用 45,127,794,688 bytes（91%），可用 4,957,241,344 bytes。
- 本地 runtime 的已分配空间为 5,949,075,456 bytes，10,222 个文件；`lessons`、`knowledge`、`resources` 分别约 3.33 GB、1.40 GB、0.99 GB。Podman images 报告为 15.37GB，其中 2.379GB 可回收，故 runtime 迁移不能被表述为唯一磁盘根因。
- Phase 0 采集时，ECS RAM Role metadata endpoint 返回 404，且尚未安装 `ossfs2`、`ossfs`、`ossutil`。截至 2026-08-13，ECS 已安装 `ossutil` 1.7.19 与 ossfs 2.0.8，并绑定 `act-runtime-oss-release-operator-ecs`。发布 bridge 只接受该 IMDS 身份且不使用永久凭据；ossfs 与 Podman runtime bind 继续只读。
- 机器可读的只读采集结果见 [Phase 0 disk report](../../artifacts/runtime-release/phase-0-production-disk-report-20260811.json)。主工作树 source revision `6ffb506f0334014df5a8304fbbd7ff54c1054e4f` 的媒体盘点见 [media inventory](../../artifacts/runtime-release/phase-0-main-runtime-media-inventory-6ffb506f.json)：121 项声明资源中，96 项 runtime 本地存在、101 项 authoring processed 存在、90 项有 legacy URL、19 项 unresolved。

首次本地 retrieval 基准只代表主工作树源盘，不代表 ossfs：`vectors.f32`、`bodies.utf8`、`lexical-postings.bin` 的结果见 [baseline](../../artifacts/runtime-release/phase-0-main-textbook-retrieval-baseline-6ffb506f.json)。候选 ossfs 挂载必须使用同一工具重新测量后才能决定是否启用热缓存。

## 未使用 OSS 对象退役

生产切到 v2 blob-view 后，Bucket 里仍可能留下完整的 v1 前缀树，以及不被 active/rollback（及 desired/publishing/retained）引用的 blob。退役只允许走 `scripts/runtime-release/retire-unused-oss-runtime.py`：

- `plan` 是默认动作，只列举和 HEAD/GET，不删除。
- 删除范围仅限 `runtime/releases/` 与不可达的 `runtime/blobs/sha256/<sha>`。
- 永不删除 `runtime/blob-releases/` 的 manifest/receipt，也不删除受保护 release 能到达的 blob。
- `plan` / `execute` 必须持有 `--state-dir` 的 lifecycle 锁，保护集只来自 desired/active/rollback/publishing/retained，并绑定 `lifecycleGeneration` 与 `lifecycleSha256`。serving proof、plan 与 receipt 必须捕获并校验同一干净 Git 修订；脏工作区失败关闭。serving proof 只证明生产仍在服务该 active/rollback，不能手填扩大或缩小保护集。
- `execute` 必须带 `--authorize-unused-oss-runtime-deletion yes`，并与已审查 plan 的 `planSha256` 完全一致；任一身份、对象集、lifecycle、Git 修订或 serving proof 漂移都失败关闭。

## 当前生产部署合同

生产已切到 v2 `ossfs-blob-view`。应用容器只读 bind 已物化 view，不再从 ECS 本地 `course-content/runtime` 提供课程内容。

- `npm run deploy:app`（`scripts/remote-deploy.sh --app-only`）只构建/上传/装载应用镜像，并绑定当前 blob-view。
- `npm run deploy:runtime` 只做本机 OSS 发布与 ECS 物化/选择，不得 rsync 完整 runtime，也不得构建镜像或改数据库。
- `npm run deploy:all` 按上述顺序组合。
- `deploy/podman/deploy.sh`（远端 `4-deploy.sh`）默认 `RUNTIME_DELIVERY_MODE=ossfs-blob-view`，只 bind 现有 view 与 helper FUSE；view 缺失时失败关闭。
- `remote-deploy.sh` 默认同样是 `ossfs-blob-view`，不会把本地 `course-content/runtime` rsync 到服务器。`legacy-rsync` 已退役；更新 runtime 只能使用 `npm run deploy:runtime`。
- v1 `ossfs-release` 命令仅用于历史 prefix release，不是日常路径。

## 身份与权限

Bucket `act-course-assets` 必须保持私有、阻止公共访问、标准存储与 SSE-OSS。不得将 AccessKey、Secret、STS token 或签名 URL 写入仓库、`.env`、脚本、manifest 或日志。

ECS 使用用户创建的受限服务角色 `act-runtime-oss-release-operator-ecs`。它的对象策略仅覆盖 `runtime/` 前缀；bridge 在 IMDS 中精确匹配该角色并以不可变 publish/verify 协议控制写入。应用仍只经只读 ossfs bind 读取 runtime，短时媒体签名不向浏览器暴露永久 Bucket URL。删除能力只可由后续独立、审查过的回收适配器在精确退役前缀上使用；当前 v2 GC 仅演练本地 mirror，不会删除 OSS 对象。

角色绑定完成后，先从 ECS 只读确认 metadata endpoint 返回角色名，再验证 role 对目标 Bucket/prefix 的最小读取能力。不要以长期 AK 作为替代方案。

### 长期身份分离（待当前 ECS 导入完成后实施）

生产读取与运行态维护是两个独立职责。生产 ECS 应长期只绑定 `act-runtime-oss-read`：ossfs、应用容器和服务端媒体签名只使用该只读身份。`act-runtime-oss-release-operator-ecs` 仅用于已经在 ECS 上执行的受控迁移或恢复任务；在这类任务结束并完成验证后，应从实例解绑，不作为生产常驻权限。

普通 RAM 角色 `act-runtime-oss-release-operator` 预留为本机或受控 CI 的维护目标角色。它只允许在 `runtime/blobs/sha256/*`、`runtime/blob-releases/*` 与明确批准的发布来源前缀内执行发布、校验和经审查的回收操作；它不授予 Bucket 级管理、生产 selector、ossfs 配置、容器或数据库权限。该角色的信任策略应限定到专用本机维护身份，例如 `act-runtime-maintainer` RAM 用户或企业 SSO/OIDC 身份；维护身份自身只拥有对该一个角色的 `sts:AssumeRole` 权限。

本机维护必须通过浏览器 OAuth、CloudSSO 或 OIDC 获取短期凭证后再 AssumeRole；不得把长期 AccessKey、Secret、STS token 写入仓库、`.env`、脚本、manifest 或日志。当前 SSH publisher/bridge 只接受 ECS IMDS 的 `act-runtime-oss-release-operator-ecs`，因此上述本机角色不能直接替代现有命令；后续必须实现并审查独立的本机 publisher adapter，保持相同的不可覆盖写入、readback 哈希校验、manifest-last 和发布互斥协议。不得以 `ossutil sync` 或普通对象覆盖取代该协议。

创建本机维护身份、收窄普通 operator 角色的信任策略以及配置本机短期认证，均不改变正在运行的 ECS 导入。导入期间不得变更 ECS 实例绑定、`act-runtime-oss-release-operator-ecs` 的有效权限或 ossfs 配置；也不得让本机维护通道与 ECS 导入并发执行发布、导入或回收写操作。仅在当前导入产生终止 manifest、远端复核通过并释放其发布锁后，才可启用本机写入通道。

## 发布、验证与检查

v1 发布命令在保存内容真源的主工作树运行。v2 发布命令必须从已冻结、可从 `origin/integration` 到达的 Git commit 的 `course-content/runtime` tree 读取 regular blobs；不得扫描工作树。本机不需要、也不得配置 OSS 长期凭据。

```bash
npx tsx scripts/runtime-release/act-runtime-release.ts plan \
  --runtime-root <main-worktree-runtime> \
  --source-revision <40-char-git-sha>

npx tsx scripts/runtime-release/act-runtime-release.ts publish-streaming \
  --runtime-root <main-worktree-runtime> \
  --source-revision <40-char-git-sha> \
  --release-id <release-id-from-plan> \
  --bucket act-course-assets \
  --ssh-target root@<ecs-host> \
  --remote-bridge-path </absolute/runtime-release-oss-publisher-bridge.py> \
  --known-hosts-file </absolute/known_hosts> \
  --identity-file </absolute/ssh-private-key> \
  --output <verification-receipt.json>

npx tsx scripts/runtime-release/act-runtime-release.ts verify \
  --release-id <release-id> --bucket act-course-assets \
  --ssh-target root@<ecs-host> \
  --remote-bridge-path </absolute/runtime-release-oss-publisher-bridge.py> \
  --known-hosts-file </absolute/known_hosts> \
  --identity-file </absolute/ssh-private-key> \
  --output <verification-receipt.json>

npx tsx scripts/runtime-release/act-runtime-release.ts inspect \
  --release-id <release-id> --bucket act-course-assets \
  --ssh-target root@<ecs-host> \
  --remote-bridge-path </absolute/runtime-release-oss-publisher-bridge.py> \
  --known-hosts-file </absolute/known_hosts> \
  --identity-file </absolute/ssh-private-key>
```

将 bridge 脚本以固定、root-owned 路径部署到 ECS 后，`publish-streaming` 以单个 SSH 流发送 frozen manifest 和缺失对象；ECS 不产生完整 runtime staging 副本。bridge 对每个 Release 前缀持有排他锁，只续传与 manifest 完全一致的既有对象，并在逐对象远端 SHA-256/size 校验后最后写入 manifest。任一中断、额外对象或不匹配都会失败，且不得生成 selection。Release prefix 从不覆盖、从不原地修复。`publish-streaming`、`verify` 与 `inspect` 都在 ECS 上通过上述精确 IMDS 角色执行，不在本机伪造 RAM Role。`verify` 核验 manifest、完整 key/size 集合和三个有上限的代表对象；完整 body hash 只保留在 publisher upload/readback 收据中。

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
npm run deploy:runtime

# 历史 v1 prefix release（非日常路径）
RUNTIME_DELIVERY_MODE=ossfs-release \
RUNTIME_RELEASE_ID=<new-release-id> \
RUNTIME_EXPECTED_ACTIVE_RELEASE=<none-or-current-release-id> \
RUNTIME_VERIFICATION_RECEIPT=<verified-receipt.json> \
RUNTIME_OSS_RAM_ROLE=<runtime-role> \
scripts/remote-deploy.sh --skip-build
```

宿主机在 `flock` 下把 desired selection 写入 ext4，并在 mount、hash、容器 `/api/readyz` 成功后才写 active receipt。OSS 不使用可变 `current.json`：OSS PutObject 不提供可依赖的 CAS 语义。

## 回退与热缓存

回退必须重新验证目标旧 Release，并传入当前 active release 作为 fence：

```bash
scripts/runtime-release/rollback-runtime-release.sh \
  --release-id <verified-old-release> \
  --expected-active-release <current-release> \
  --verification-receipt <old-release-receipt.json> \
  --ram-role <runtime-role>
```

候选挂载如果造成 retrieval 明显、可重复的读取退化，可运行 `stage-textbook-retrieval-hot-cache.ts`。它只复制三项热索引，目录以 manifest SHA-256 命名并逐文件校验；未出现候选性能回归时不得启用该缓存。

## 删除前的人工确认点

删除旧 ECS runtime 必须显式传入 `execute-production-runtime-cutover.sh --delete-legacy-runtime`，并同时指定已验证的 OSS rollback Release 与其 receipt。该受限操作仅在 active receipt 已选择新 Release、app 将该 Release 的只读 ossfs 路径唯一 bind 到 `/app/course-content/runtime`，且最多只有同一 Release 的 `knowledge/projection` 只读子路径 bind、app/worker 都不再持有 legacy runtime 或其子路径的 bind、worker 不持有 runtime、Authority 或 Teaching Projection 的文件系统 bind、`readyz` 正常、rollback Release 能重新挂载并通过 manifest/文件集合/代表性内容验证之后执行。它只删除精确 legacy runtime 目录，保留 OSS 中的新旧 Release、selector、active receipt 和退休收据。

预期可释放的上限是当前 runtime 已分配空间约 5.95GB；实际释放量受文件系统块、仍保留的热缓存和旧目录状态影响。

未解决风险：生产容器尚未以该候选 Release 启动，因而 application-level 课程路由与媒体短时 redirect 仍须在实际切换事务中验证；19 项媒体输入仍 unresolved。旧 ECS runtime 的删除继续等待生产 smoke、可回退 Release 与人工确认。

## v2 Blob Release 候选流程（不含生产选择）

v2 将相同 SHA-256 内容存为 `runtime/blobs/sha256/<sha256>`，每个逻辑 Release 仅保留 `manifest.json` 与 `receipt.json`。该流程不修改 v1 selector、active receipt、ossfs 挂载、Podman bind 或生产角色；候选通过前，v1 仍是唯一生产 authority。

1. 在冻结的 Git commit 上计算候选身份。v2 CLI 必须从该 commit 的 `course-content/runtime` Git tree 读取 regular blob，不能扫描工作树；正式发布的 commit 必须是 `origin/integration` 的祖先。`build-manifest` 只写本地候选文件，不能视为已发布。

   ```bash
    npx tsx scripts/runtime-release/act-runtime-release.ts build-manifest \
     --repo-root <repository-root> \
     --source-revision <40-char-git-sha> \
     --format v2 \
     --output <candidate-manifest.json>
   ```

2. 通过现有 SSH publisher 以 `--format v2` 发布。bridge 只将缺失 blob 条件写入，独立校验已存在 blob 的 size/SHA，写入 immutable receipt 后才把 manifest 作为终止对象。publish receipt 和后续 verify receipt 都必须保存，且不得包含凭据。
3. 以当前 ECS operator role `inspect --format v2` 取得远端 manifest 与 receipt；将 blob namespace 以只读 ossfs 挂载到仅宿主机可见的目录。在 ext4 候选目录执行 `materialize-runtime-blob-release.py prepare`、`verify`，再测量教材索引的 cold、warm、concurrent 读取。`select` 只改变候选 view-root 的本地 `current` 指针，不得接入 Podman。
4. 使用 `runtime-blob-release-lifecycle.py` 初始化独立候选 state。marker 缺失时 v1 state 仍有效；marker 为 `v2` 后 lifecycle/journal 为唯一 authority。desired、active、rollback、publishing 与 retained lease 都进入 protected set，失败的 desired 不能被 GC 删除。Release 离开 active/rollback 时，状态事务自动写入不短于媒体签名最大 TTL 的 lease；只在 deadline 已到且 generation-CAS 的 `release-retained` 成功后取消该保护。
5. 只对 disposable local mirror 演练 `runtime-blob-release-gc.py plan` 与 `execute`。真实 OSS 回收必须另有经审查的 bridge deletion adapter、同一 lifecycle lock、完整 continuation-safe object index、generation fence、逐对象 readback 和删除 receipt；普通 GC 不删除 manifest 或 receipt。

候选完成证据至少包含：发布/读取 receipt、manifest/blob closure、物化目录全量校验、课程/媒体/检索 smoke、cold/warm/concurrent benchmark、lifecycle crash/recovery、GC dry-run，以及 v1 rollback projection。满足这些条件后，才可单独请求 v2 production selection 授权。
