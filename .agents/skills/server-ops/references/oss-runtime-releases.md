# OSS 不可变运行时发布与 ossfs 兼容挂载

适用范围：将 ACT 的 `course-content/runtime` 从 ECS 本地磁盘迁移到私有 OSS Bucket，并以 ossfs 2.0 保持应用的 Node `fs` 读取合同。此参考文件只用于已经触发 `server-ops` 的远端操作；本地设计、Release 工件和测试不因此启用远端操作。

## 身份与权限边界

- 先以只读方式检查 ECS 的磁盘、容器挂载、现有 runtime 体积、RAM Role metadata、`ossfs` 与 `ossutil` 可用性。没有可用 ECS RAM Role 时，停止 OSS 写入、挂载和切换，只提交所需最小 RAM policy；不得改用长期 AccessKey 或把密钥写入仓库、`.env`、脚本或主机配置文件。
- 需要通过 ECS 控制台投予实例的角色，必须按“云服务 → 云服务器 ECS / ECS”创建，并在信任策略中使用 `ecs.aliyuncs.com`。信任当前云账号的普通 RAM 角色不能由 ECS 扮演；为实例角色创建前应复用已审计的最小 OSS 自定义策略，而不是授予 OSS 全权限。
- 常规服务 ECS 只持有 `act-runtime-oss-read`，只读 ossfs 与 Podman runtime bind 仍必须只读。日常 v2 发布由本机受限 publisher 身份完成：启动时用 caller identity 校验账户、principal、Bucket、Region、endpoint 与前缀，并以本机 `flock` 串行。凭据只来自本机受管 credential provider；不得写入仓库、`.env`、脚本、release manifest 或日志。ECS 只执行只读物化、应用 smoke 和受锁的本地选择；浏览器不获得永久 OSS URL。
- 本机 publisher 凭据的固定存放位置（2026-08-25 核实）：
  - `~/.config/act/runtime-dev-read.env`（mode 0400）：`ALIBABA_CLOUD_ACCESS_KEY_ID` / `ALIBABA_CLOUD_ACCESS_KEY_SECRET` 与 `ACT_RUNTIME_OSS_BUCKET` / `ACT_RUNTIME_OSS_ENDPOINT` / `ACT_RUNTIME_OSS_REGION` / `ACT_RUNTIME_OSS_EXPECTED_RAM_USER`（`act-runtime-dev-read`）/ `ACT_RUNTIME_OSS_EXPECTED_ACCOUNT_ID`。发布前 `source` 该文件；不得回显、复制或移动其内容。
  - 安装与重置入口：`~/.config/act/install-runtime-dev-read-credentials.zsh`（隐藏输入读取 AK/SK，umask 077 原子写入；目标文件已存在时拒绝覆盖，重置需先手动删除旧文件再运行）。
  - 发布工件 spool 与 artifact 目录：`~/.local/state/act-runtime-publisher/artifacts/`（`deploy-runtime-blob-release.sh --artifact-dir` 的历史落点，含 manifest / lifecycle-identity / receipt / publisher-verification）。
  - `scripts/runtime-release/developer-oss/credential.py` 默认读写 `~/.config/act-runtime-dev-read/credentials.json`（developer 工具链的副本路径）；本机实际使用的是上面的 `~/.config/act` 路线，两者不要混用。
  - 发布会话环境装配入口（2026-08-25 重建并固化）：`source ~/.config/act/publisher-env.zsh`。它依次完成：source 凭据 env；内存桥接 `OSS_ACCESS_KEY_ID/SECRET`、`OSS_REGION`、`OSS_ENDPOINT`（ossutil 2.x 的 env 名，不落盘）；设定 `ACT_RUNTIME_LOCAL_IDENTITY_COMMAND(._SHA256)`（`~/.config/act/publisher-identity.zsh`——固定 region 的 aliyun CLI 包装，满足 bridge 的 `sts GetCallerIdentity → {AccountId, Arn}` 契约）；`ACT_RUNTIME_LOCAL_OSSUTIL(._SHA256)`（`~/.config/act/tools/ossutil`，2.3.0 mac-arm64，官方 `gosspublic.alicdn.com/ossutil/v2/2.3.0/ossutil-2.3.0-mac-arm64.zip`，sha256 `8c84259d886e131646150535935faa94ef7ac5af9c14ce7486fde41c364389f1`）；`ACT_RUNTIME_LOCAL_PYTHON`；`ACT_RUNTIME_OPERATOR_ACCOUNT_ID` / `ACT_RUNTIME_OPERATOR_PRINCIPAL_ARN`（dev-read RAM 用户身份）；`ACT_RUNTIME_PUBLISH_LOCK_DIR` / `ACT_RUNTIME_PUBLISH_SPOOL_DIR`（`~/.local/state/act-runtime-publisher/`）；`ACT_RUNTIME_SSH_KNOWN_HOSTS_FILE`。装配脚本自带 identity preflight 自检，全部就绪后输出 `publisher env ready`。
  - 网络注意：本机代理（127.0.0.1:7890，Clash fake-ip DNS）对 `*.alicdn.com` 的直连与代理都会失败（域名解析为 198.18.x 假 IP）。下载/访问阿里云 CDN 资源时需先经 DoH 解析真实 IP（如 `curl 'https://dns.alidns.com/resolve?name=<host>&type=A'`），再 `curl --noproxy '*' --resolve <host>:443:<ip>` 直连；正式 ossutil 分发域名是 `gosspublic.alicdn.com`（`gossutil.alicdn.com` 已不存在）。
- Bucket 保持私有、阻止公共访问和服务器端加密。需要浏览器访问的媒体由服务端根据 allowlist 生成短时下载重定向；不得把 OSS 签名 URL 固化到 runtime 文件或长期配置。
- 若 Next.js standalone 应用使用 `ali-oss` 与 `@alicloud/credentials` 生成该重定向，二者必须列为 `serverExternalPackages`，避免 Turbopack 进入 `urllib` 的动态 `proxy-agent` 分支并在生产构建失败；以生产所需 Node heap 完成一次 standalone build 验证。

## Release 与选择不变量

- v1 release 只使用不可变的 `runtime/releases/<release-id>/` 前缀；v2 blob release 只使用独立的 `runtime/blob-releases/<release-id>/` 前缀。两个格式允许同一 `{sourceRevision, treeSha256}` 推导出相同 release ID，完整身份必须包含 format、namespace、release ID 与 manifest SHA-256；不得借路径冲突篡改 source identity，也不得在共享前缀中混合读取、验证或删除。
- `ossutil sync` 的增量比较只适合同一可变目标前缀，不能减少不同不可变 Release 前缀之间的上传或存储；在同一 release id 的中断重试中，由发布桥按对象 key、大小和 SHA-256 精确续传即可。若要跨 Release 复用对象，必须单独设计内容寻址 blob、Release manifest 与可验证的运行态 materialization，不能以 `sync` 覆盖或删除现有 Release。
- 发布前必须先在声明的内容真源目录计算完整 manifest；仅有相同 Git revision 不足以证明 ECS 既有 runtime 与该真源字节相同。若准备直接以 ECS 本地 runtime 为上传源，必须独立重算其 file count、total bytes 与 tree SHA-256，并与真源 manifest 完全一致；不一致时不得上传 ECS 旧树、不得覆盖正在服务的 legacy runtime，也不得在接近满盘的主机上复制完整 staging 目录。此时应使用经审计的流式本地→ECS publisher transport，或另行准备有容量的发布执行环境。
- 首次导入、协议升级、存储异常后和人工触发的 full audit 必须从 OSS 重新读取并校验 manifest 与所有唯一 Blob 的大小和哈希；任一缺失或不匹配均不得选择该 Release。不得复用、覆盖或原地修复已经发布的 Release。
- 日常 v2 发布以 immutable parent manifest 作为证明缓存：只读取、哈希、HEAD 和上传 changed/unknown Git Blob；同 Git OID 的 rename 直接继承，继承 Blob 不得再次下载、重新哈希或逐项 HEAD。Blob 条件写入后立即以大小和 metadata 复核，receipt 先于 terminal manifest 写入。ECS 后续验证只需校验 manifest/receipt、view receipt、只读挂载、拓扑、变更 Blob 与代表性读取；全量 body-hash 审计属于独立周期性诊断。
- OSS `PutObject` 不具备条件写入语义，不能把对象存储中的可变 `current.json` 当作并发安全的生产指针。单 ECS 的运行时选择使用宿主机 ext4 上受权限保护的 state directory：固定 `flock` 锁、期望 active release、单调 generation、临时文件 `fsync`、原子 rename、目录 `fsync`。desired selection 与 health 后写入的 active receipt 分开保存。
- 任何仍会替换 Legacy runtime 目录或重建其消费者的部署路径，也必须在远端实际变更脚本内持有同一 `.act-runtime-selection.lock`，覆盖停止消费者、目录提升、容器重建、readiness 与失败恢复；本地调用器或多次 SSH 连接不能构成锁。OSS active receipt 已存在时，Legacy 路径必须失败关闭。
- 回滚仅选择一个已完整复核的旧 Release；先写 desired，再重新挂载并重启容器，健康检查成功后才更新 active receipt。失败的候选不得覆盖此前 active receipt。

## ossfs 与 Podman

- 使用 ossfs 2.0、ECS read RAM Role 与同地域内网 endpoint。v2 只读挂载 `runtime/blobs/sha256/` 到独立 blob 根，由本地目录与相对符号链接组成 release view，再以一个只读 bind mount 提供给容器中的 `/app/course-content/runtime`。
- ossfs 配置中的 `--ram_role` 必须与 ECS IMDS 当前唯一 read role 名完全一致；角色具备 `GetObject` 并不足够，名称不一致时 FUSE 仍可能显示为 `ro`，但目录无法读取。角色切换或 ossfs 重挂载会使已存在的 Podman bind 挂载变为 `Socket not connected`，必须通过受管 stack 的正常启动路径重建 app/worker 容器，再核验容器内 runtime 条目、release manifest 与 `/api/readyz`。
- 切换 ECS read role 前，先以新角色对目标 release 执行只读 `ListObjectsV2` 和读取 release manifest 的验证；两项都成功后才停止旧 ossfs mount。`ossfs2` 的挂载 credential 校验本身调用 `ListObjects`，因此 `oss:GetBucketInfo` 不能替代 bucket 资源上的 `oss:ListObjects`。前缀策略至少应允许 `runtime/releases`、`runtime/releases/`、`runtime/releases/*`，并在对象资源上允许 `runtime/releases/*` 的 `oss:GetObject`；不得借此加入任何写入或删除操作。
- 若角色切换期间 runtime mount 已失效，先恢复目标只读 mount，再通过 `deploy/podman/deploy.sh --runtime-cutover-app-only` 重建 app/worker。该命令依赖既有 PostgreSQL 与 Redis 容器；若它们是此前受控停机而非异常退出，可先仅启动相同名称的既有容器，禁止创建替代容器、删除卷或重建数据库。最终必须复核 IMDS 角色名、FUSE `ro`、容器的只读 runtime bind、`/api/readyz` 和媒体的短时重定向。
- v2 `ossfs-blob-view` 的开机依赖是一对 oneshot：`act-runtime-blob-ossfs.service` 挂 `/home/projects/act/data/runtime/ossfs/blobs`，`act-runtime-blob-view-helper.service` 再把该根 bind+ro 到 current view 的 `.act-runtime-blobs`。只 enable blob 根不够，`4-deploy.sh` 检查的是 helper 是否为 FUSE。生产 stack 的 `20-runtime-ossfs.conf` 必须 `Requires=` 这两个单元，而不是 v1 的 `act-runtime-ossfs@<release-id>.service`。旧 drop-in 在重启后只会挂回 rollback prefix，helper 变成普通空目录，公网 502。恢复顺序：先 start 两个单元，再 `--app-only` 用现有镜像重建 app/worker。
- v0.18 生产选择器是写在 blob-view 上的普通 `current.json`，不是 Git 树里的 v0.9 叶链接。`deploy:runtime` 按 Git tree 重放物化会把这些指针冲回 v0.9；在没有选择器保留事务前，禁止对已 cutover 的生产 view 做增量 rematerialize。
- ossfs 2.0 的配置文件使用 `ossfs2 mount <mount-root>/<release-id> -c <release-id>.conf`；必须显式写入 `--ro=true`、`--allow_other=true`、目标 uid/gid、`--file_mode=0644` 与 `--dir_mode=0755`。不要依赖 ossfs 默认权限，也不要在配置文件中写 AccessKey/Secret。
- 不得将现有 `.staging`、`current`、`previous` 的 rsync/rename 发布算法直接运行在 ossfs 挂载点；OSS runtime Release 永远不依赖目录 rename 原子性。
- 当 ECS 无法同时容纳完整 image tar 与 Podman 解包层时，不得以磁盘 staging、手工管道或删除现有镜像绕过容量。受控流式导入必须先从本地已验证 tar 固定 config image ID、OCI revision 与 layer 字节总量；远端 `GraphRoot` 可用空间必须不少于 layer 总量加 1 GiB。通过该门禁后，同一 SSH stdin 只能同时送入 SHA-256 与 `podman load`，二者结束并精确核对 tar 摘要、image ID 和 revision 后才能激活；空间不足时停止并先扩容。
- 挂载或切换前后都用 `findmnt -T <mount-root>/<release-id>` 确认 FUSE 与 `ro` 选项，并确认容器 bind mount 的只读状态、容器内目录可遍历性，以及应用实际读取 runtime 与教材热索引的 smoke。保留一个已验证 previous release 与其 rollback receipt。
- `resources/textbook-retrieval` 的向量和倒排索引必须在 ossfs 挂载后的实际读取基准下评估。只有可重复的明显退化才允许保留有上限、带哈希和失效策略的本地热缓存；不以形式上的全量对象化牺牲检索性能。

## v2 日常增量发布

- `deploy:runtime` 只处理 Git-tree 增量规划、本机发布、ECS view 物化、runtime consumer restart 与 smoke；不得构建镜像、传输 image tar、处理数据库、Prisma、Nginx、systemd 或完整 runtime `rsync`。
- `deploy:app` / `remote-deploy.sh --app-only` 只处理应用镜像与应用部署，默认 `RUNTIME_DELIVERY_MODE=ossfs-blob-view`，绑定远端已物化 view；`4-deploy.sh` 只做只读 bind，不复制 runtime。
- `remote-deploy.sh` 不再默认 rsync。`legacy-rsync` 已退役；更新 runtime 只能使用 `npm run deploy:runtime`。`deploy:all` 仅在两者都变化时按顺序组合。不要让 runtime-only 修改进入 image/database 发布链路。
- 目标 revision 必须可从 `origin/integration` 到达。Git tree 中同 OID 的 entry 复用父 manifest 的 SHA/size；没有 stable Git 或显式 external/generated source identity 的文件拒绝发布。运行时未变时返回 parent release 并停止，不创建新 Release。
- sample/full audit 是独立只读命令。sample 采用稳定样本，full 读取所有唯一 Blob；失败冻结发布和 GC。日常 selection 不得将这两类 audit 重新纳入部署关键路径。

## 发布与删除顺序

1. 记录宿主机和 Podman 的磁盘报告；不要在调查阶段删除 runtime、镜像、tar 或数据库文件。
2. 上传并远端复核候选 Release，演练只读挂载、容器读取、媒体重定向和 rollback。
3. 获得明确的生产切换授权后，执行受锁的 release selection，重启容器并完成 smoke；保存 selection、active receipt 和 rollback 证据。
4. 旧 ECS runtime 只能在成功 smoke 后再次报告空间占用和可用 rollback，并等待人工确认后删除。

删除通过受限脚本执行时，脚本必须在删除前再次确认 active receipt、app 与 worker 的只读 ossfs bind、`readyz` 与独立 rollback Release 的可挂载性。删除目标必须是明确的 non-symlink legacy runtime 目录；使用不跨文件系统、也不跟随 symlink 的遍历删除，使嵌套挂载导致失败而不是被误删。删除后写入不含凭据的 retirement receipt，保留 OSS Release、selector 和 active receipt。

## 失败处理

- RAM Role metadata 不可用、OSS endpoint 不可达、manifest/对象校验失败、挂载非只读、容器 smoke 失败或 active receipt 未写入时，停止切换并保持当前运行时。
- 使用单一 operator role 的 ECS，bridge 仍须在每个操作前精确验证 IMDS 角色名；ossfs 与容器 bind 必须始终保持只读。任何将角色策略扩展到 Bucket、其他前缀或永久凭据的变更都须单独审查，不能借发布或回收流程附带完成。
- 运行时选择脚本持有宿主机 `flock` 时，启动 Podman 的部署子进程必须关闭该锁文件描述符，但父脚本持续持锁。否则 `conmon` 会继承锁并在容器存活期间阻塞后续切换；不得删除锁文件或绕过该锁恢复操作。
- 将 `ali-oss` 发布器打包为独立 Node 运维命令时，`urllib` 的可选 `proxy-agent` 依赖会使 esbuild 静态解析失败。可将该可选模块 externalize，但必须先确认 ECS 无 HTTP(S)/ALL proxy 环境，并在目标 Node 版本上运行一次只读 plan/inspect 验证；不得用该策略绕开真实代理依赖。
- 部署 ECS-side 运维脚本前先读取目标 `python3 --version` 并在该最低版本语法范围内编写。当前 ECS 为 Python 3.6.8：不得使用 `from __future__ import annotations`、内置泛型（如 `list[str]`）、`X | None` 或 `subprocess.run(text=True)`；使用 `typing.List`/`Optional` 与 `universal_newlines=True`。部署后先在 ECS 执行 `python3 -m py_compile`，通过前不得启动发布协议。
- `rtk` 会为节约输出截断长文本行，不能用于判断 OSS object key 是否完整。需要核对协议输出、路径或摘要时，使用不经输出压缩的 `rtk proxy` 或在 bridge 子进程内直接解析；不得把工具展示层的省略号当作远端返回值。
- 当前 ECS 的 `/usr/local/bin/ossutil` 1.7.19 不能可靠处理 stdin，且其 `cat` 会把耗时摘要写到 stdout；它只用于 `ls <prefix> -s` 的独立只读 key-set 交叉检查，不能作为 writer。固定 writer 是经官方下载 ZIP SHA-256 校验的 `/opt/act-ops/ossutil-2.3.0/ossutil`：bridge 每次先从 IMDS 证明唯一 `act-runtime-oss-release-operator-ecs` role，再显式传入 `--mode EcsRamRole --endpoint oss-cn-hangzhou-internal.aliyuncs.com --region cn-hangzhou`；普通 `cp -` 会覆盖同名对象，不能用于 immutable Release。为得到 OSS 服务端的禁止覆盖保证，单对象流先写入 root 0700 spool 目录中 0600、不可预测的临时文件（最大 256 MiB、至少保留 1 GiB 磁盘空间），随后仅通过 `api put-object --body file://… --forbid-overwrite true` 写入并立刻重读校验和删除。绝不建立完整 runtime staging。
- ossutil 2 的 `api list-objects-v2 --output-format json` 在单对象页会把 `Contents` 输出为 object 而非 array，bridge 必须规范化缺失、object 与 array 三种形态，并使用 continuation token 完整分页；不得从被截断的 v1 `ls` 行推导 object key。
- ossutil 2 的真实 `api head-object --output-format json` 会在 `Header` 内将 `Content-Length`、`Etag` 与自定义元数据表示为单元素数组；桥接须在读取前把单元素数组规范化为标量，而多元素数组必须失败关闭，不能把数组直接传入大小、ETag 或摘要校验。
- 不在远端源码构建，不通过 ECS 代理大型视频，不开启 public-read，也不为排障降低 Bucket 私有访问策略。

## 内容寻址 Blob Release（v2，候选资格）

- v2 只在已完成格式、物化、生命周期和回收资格验证后使用：逻辑 manifest 位于 `runtime/blob-releases/<release-id>/manifest.json`，逐文件 key 必须等于 `runtime/blobs/sha256/<file-sha256>`；release prefix 只允许 immutable `manifest.json` 与 `receipt.json`。不得在 release prefix 内复制逻辑文件，也不得用可变对象替代 manifest。
- 首次 v1→v2 导入必须固定一个 v1 release ID、其 manifest semantic SHA-256 与 wire SHA-256；bridge 读取、重算并校验每个源对象后才允许写入 v2 blob，最后写 receipt 与 manifest。导入前后再次读取固定 v1 manifest；任一 identity、路径、大小或摘要漂移均失败关闭。导入尚未完成 v2 selection 前，v1 active release 不得删除。
- 为 v2 导入授权 operator role 时，Bucket 级 `oss:ListObjects` 的 `oss:Prefix` 需显式加入 `runtime/blob-releases/` 与 `runtime/blob-releases/*`；对象级 Get/Put/Delete 仅加入 `acs:oss:*:*:act-course-assets/runtime/blob-releases/*`，blob 复用继续限定于 `runtime/blobs/sha256/*`。不为 v2 importer 增加 v1 `runtime/releases/*` Delete，也不放宽 selector 权限。Policy 更新后先验证 IMDS role、bridge `py_compile` 与只读 list，再开始导入。
- 若 IMDS 已精确返回 operator role、bridge 也已通过目标 Python 版本编译，但对 `runtime/blob-releases/` 的 `ListObjectsV2` 返回 OSS `403 AccessDenied`（控制台文案可能是“bucket 不属于你”），应视为该 role 缺少新 namespace 的 prefix-scoped policy，而不是改用 AccessKey、改变 endpoint 或开始写入。补齐上述最小前缀后，先重跑同一只读 list；成功前不得启动 v1→v2 导入。
- 面向发布的 v2 CLI 必须将 source revision 解析为完整 Git commit，并只从该 commit 的 `course-content/runtime` Git tree 读取 regular blob；禁止把任意 SHA 与工作树扫描混用，禁止读取 symlink、gitlink、checkout filter 或未追踪文件。正式发布的 source commit 必须可从 `origin/integration` 到达，保证合作开发者同步集成分支后能够重建同一 manifest。
- `manifestSha256` 是不含自身字段和传输字段的 canonical 语义摘要；最终 manifest 字节的 SHA-256 和长度写入 immutable receipt。读取顺序固定为：先核对 receipt 的 wire digest/长度，再解析并核对 manifest 语义摘要、tree、release ID 与 blob 闭包。把最终 wire digest 写回 manifest 自身会形成不可生成的自引用，禁止采用。
- 同一 blob 的条件冲突只有在单独 readback 精确验证大小和 SHA-256 后才可视为成功。所有 blob 通过验证后先写 receipt，manifest 是唯一终止写入；未出现 manifest 的发布一律不可选择。重复发布同一 Release 只能做 readback，不得覆盖。
- v2 候选把只读 blob 挂载物化为宿主机拥有的真实目录树和受控叶链接。根、逻辑目录、compatibility manifest 和物化 receipt 都必须是非链接对象；叶链接只能指向同一只读 blob mount 内由 manifest SHA 推导出的常规文件。物化器在独占宿主机锁内全量校验路径集、目标边界、大小和 SHA，再通过本地 `rename` 原子替换其 `current` 指针。该指针不在 OSS，也不进入容器。
- symlink forest 不是天然兼容。先以真实候选运行 `runtime-content-path`、课程枚举/讲义、公开资源路由、媒体 allowlist、媒体 inventory、教材检索和 readiness smoke。任何 `lstat`、`realpath`、目录遍历或 watcher 观察不兼容都阻止 v2 生产选择；保留 v1 prefix release，不能以复制 blob 或放宽路径检查掩盖问题。
- v2 host authority 使用持久 marker：marker 缺失仅表示从未迁移，可读取 v1 selection/active receipt；`mode=v2` 时 lifecycle record 是唯一 authority，缺失或损坏只能从 marker 精确绑定的 journal after-image 恢复，否则失败关闭；v2→v1 rollback 写入并验证 v1 projection 后记录 `mode=v1-rollback`，绝不删除 marker。desired、active、rollback、publishing 与 retained lease 都是独立 GC root；failed desired 在显式取消、替换或成功激活前不得回收。Release 离开 active/rollback 的同一事务必须写入包含 UTC 时间、受控最大签名 TTL、派生 deadline 与策略版本的 lease；重复 retain 只能延长，`release-retained` 仅在 deadline 后经 generation-CAS 成功，时钟回拨或 lease 损坏必须失败关闭。
- Blob GC 先在同一 lifecycle lock 内捕获 generation、lifecycle digest、全部受保护 manifest/receipt 和完整 continuation-safe object index，输出 immutable dry-run plan。执行前再次读取并比较 generation、index 和每个候选 blob 的大小/SHA；只允许删除 `runtime/blobs/sha256/<sha>` 中经重验的不可达 blob，普通 GC 永不删除 manifest 或 receipt。任何分页、identity、manifest、marker 或 selector 漂移均为零删除。
