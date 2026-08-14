# ACT Runtime OSS 迁移操作手册

本手册约束 `course-content/runtime` 的第一阶段迁移：runtime 以不可变 Release 存储于私有 OSS，ECS 通过 ossfs 2.0 的只读挂载继续提供既有 Node `fs` 路径。它不授权 Bucket 配置变更、生产切换或删除旧数据。

## 当前基线

- 生产主机根分区为 ext4，容量 52,447,014,912 bytes，已用 45,127,794,688 bytes（91%），可用 4,957,241,344 bytes。
- 本地 runtime 的已分配空间为 5,949,075,456 bytes，10,222 个文件；`lessons`、`knowledge`、`resources` 分别约 3.33 GB、1.40 GB、0.99 GB。Podman images 报告为 15.37GB，其中 2.379GB 可回收，故 runtime 迁移不能被表述为唯一磁盘根因。
- Phase 0 采集时，ECS RAM Role metadata endpoint 返回 404，且尚未安装 `ossfs2`、`ossfs`、`ossutil`。截至 2026-08-11，ECS 已安装 `ossutil` 1.7.19 与 ossfs 2.0.8，并已恢复受限的 `act-runtime-oss-read` 角色；该身份只用于发布完成后的读取、候选挂载与运行态服务。
- 机器可读的只读采集结果见 [Phase 0 disk report](../../artifacts/runtime-release/phase-0-production-disk-report-20260811.json)。主工作树 source revision `6ffb506f0334014df5a8304fbbd7ff54c1054e4f` 的媒体盘点见 [media inventory](../../artifacts/runtime-release/phase-0-main-runtime-media-inventory-6ffb506f.json)：121 项声明资源中，96 项 runtime 本地存在、101 项 authoring processed 存在、90 项有 legacy URL、19 项 unresolved。

首次本地 retrieval 基准只代表主工作树源盘，不代表 ossfs：`vectors.f32`、`bodies.utf8`、`lexical-postings.bin` 的结果见 [baseline](../../artifacts/runtime-release/phase-0-main-textbook-retrieval-baseline-6ffb506f.json)。候选 ossfs 挂载必须使用同一工具重新测量后才能决定是否启用热缓存。

## 身份与权限

Bucket `act-course-assets` 必须保持私有、阻止公共访问、标准存储与 SSE-OSS。不得将 AccessKey、Secret、STS token 或签名 URL 写入仓库、`.env`、脚本、manifest 或日志。

发布者与 ECS runtime 身份分离：

- 发布者仅需目标前缀 `runtime/releases/<release-id>/` 的 `ListObjects`、`GetObject`、`PutObject`；首阶段不授予删除权限。发布失败留下的对象前缀不可被激活。
- ECS runtime RAM Role 仅需同一前缀的 `ListObjects` 和 `GetObject`。应用的短时媒体签名使用该角色的临时凭据，不向浏览器暴露永久 Bucket URL。

角色绑定完成后，先从 ECS 只读确认 metadata endpoint 返回角色名，再验证 role 对目标 Bucket/prefix 的最小读取能力。不要以长期 AK 作为替代方案。

## 发布、验证与检查

发布命令在保存内容真源的主工作树运行，ECS 只在短时绑定 publisher RAM Role 后充当受限的流式 OSS 写入端；本机不需要、也不得配置 OSS 长期凭据。source runtime 必须来自主工作树的实际目录，而不是 Git tracked 文件集合。

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

将 bridge 脚本以固定、root-owned 路径部署到 ECS 后，`publish-streaming` 以单个 SSH 流发送 frozen manifest 和缺失对象；ECS 不产生完整 runtime staging 副本。bridge 对每个 Release 前缀持有排他锁，只续传与 manifest 完全一致的既有对象，并在逐对象远端 SHA-256/size 校验后最后写入 manifest。任一中断、额外对象或不匹配都会失败，且不得生成 selection。Release prefix 从不覆盖、从不原地修复。发布结束后立即将 ECS 恢复到 read-only runtime role；`verify` 与 `inspect` 均通过该角色在 ECS 上执行，不在本机伪造 RAM Role。read-role 的 `verify` 核验 manifest、完整 key/size 集合和三个有上限的代表对象；完整 body hash 只保留在 publisher upload/readback 收据中。

## 2026-08-11 实际候选证据

首个完整 Release 为 `runtime-b2f0b07c428faba4317bf2f5b7ad51f0858165dee8651fcea52eb6a`，绑定 source revision `3097ebc204d65b2722cfdc1423e0d1646e37d55d`、10,222 个文件、5,924,691,879 bytes、tree SHA-256 `2fd9eec21142994ea97bf971225b1ad24a85ee6346ec17d8ff96d2da93708133`、semantic manifest SHA-256 `75912510df1f3e9b89801702dea9747ce15e0af117317886dabc9965b760f326` 与 wire SHA-256 `fc6ead8721b950731a866d652a01020ea5626b741c06af98f4264891d13ed88f`。

- `act-runtime-oss-read` 经 ECS IMDS 确认后，重新读取 OSS manifest 并精确匹配 wire SHA-256。
- Release 挂载在独立候选路径 `/home/projects/act/data/runtime/ossfs/releases/<release-id>`；`findmnt` 证明为 FUSE 且 `ro`，未创建 `act-runtime-selection.json` 或 `act-runtime-active-receipt.json`。
- `verify-mounted` 对候选目录完成逐文件文件集、size 与 SHA-256 复核，结果为 10,222 个文件和 5,924,691,879 bytes。
- 无网络临时 Node 容器以 `/app/course-content/runtime:ro` bind mount 读取 `vectors.f32`，并确认写入返回 `EROFS`。
- 三次完整读取并 SHA-256 校验的候选基准：`vectors.f32`（54,444,032 bytes）190.441 / 194.310 / 198.389 ms；`bodies.utf8`（46,759,868 bytes）163.649 / 177.434 / 165.487 ms；`lexical-postings.bin`（8,747,083 bytes）35.434 / 29.876 / 32.942 ms。没有可重复的明显退化证据，因此未启用本地 hot cache。
- 候选回退演练停止并重新启动该候选 ossfs unit；现有应用继续从 legacy runtime 只读 bind mount 运行且 `/api/readyz` 正常，selector 与 active receipt 均保持缺席。

## 候选挂载与切换清单

1. 确认 ECS 绑定 runtime RAM Role，并安装 ossfs 2.0。配置使用 `oss-cn-hangzhou-internal.aliyuncs.com`、`oss_bucket_prefix=runtime/releases/<release-id>/`、`--ro=true` 与显式 uid/gid/file/dir mode。
2. 发布器的逐对象 upload/readback receipt 是完整内容完整性证明。恢复 read role 后，读取并严格解析 manifest、精确比对 OSS object key 集合，并读取代表性发布媒体；不为每次切换再次读取整个 Release。将 receipt 和 host tools 同步到 ECS。禁止将 runtime 内容 rsync 到 `.staging`、`current` 或 `previous`。
3. 在候选挂载上运行：manifest、精确文件集合、全部 size 元数据与有上限的代表性内容校验、FUSE/read-only 检查、课程资源 smoke、媒体 `/api/course-runtime/assets/...` 短时重定向、`benchmark-textbook-retrieval.ts`。
4. 只有所有候选证据合格，才以显式模式调用部署：

```bash
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
