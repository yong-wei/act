# OSS 不可变运行时发布与 ossfs 兼容挂载

适用范围：将 ACT 的 `course-content/runtime` 从 ECS 本地磁盘迁移到私有 OSS Bucket，并以 ossfs 2.0 保持应用的 Node `fs` 读取合同。此参考文件只用于已经触发 `server-ops` 的远端操作；本地设计、Release 工件和测试不因此启用远端操作。

## 身份与权限边界

- 先以只读方式检查 ECS 的磁盘、容器挂载、现有 runtime 体积、RAM Role metadata、`ossfs` 与 `ossutil` 可用性。没有可用 ECS RAM Role 时，停止 OSS 写入、挂载和切换，只提交所需最小 RAM policy；不得改用长期 AccessKey 或把密钥写入仓库、`.env`、脚本或主机配置文件。
- 发布者与生产运行时身份必须分离。发布者只可写 `runtime/releases/<release-id>/`；运行时仅可对已经选定的 Release 前缀执行必要的 `GetObject`/`ListObjects`。浏览器不获得永久 OSS URL。
- Bucket 保持私有、阻止公共访问和服务器端加密。需要浏览器访问的媒体由服务端根据 allowlist 生成短时下载重定向；不得把 OSS 签名 URL 固化到 runtime 文件或长期配置。
- 若 Next.js standalone 应用使用 `ali-oss` 与 `@alicloud/credentials` 生成该重定向，二者必须列为 `serverExternalPackages`，避免 Turbopack 进入 `urllib` 的动态 `proxy-agent` 分支并在生产构建失败；以生产所需 Node heap 完成一次 standalone build 验证。

## Release 与选择不变量

- 每次发布写入唯一且不可变的 `runtime/releases/<release-id>/` 前缀。release id 必须由 canonical `{sourceRevision, treeSha256}` 的 SHA-256 派生，避免不同 source identity 并发写入同一前缀；同一 identity 的重试仍必须以远端 receipt 精确核对 manifest/tree digest。Release manifest 必须记录 schema、source revision、文件数量、总字节数、逐文件相对路径/大小/SHA-256、tree digest 和 manifest digest。
- 发布前必须先在声明的内容真源目录计算完整 manifest；仅有相同 Git revision 不足以证明 ECS 既有 runtime 与该真源字节相同。若准备直接以 ECS 本地 runtime 为上传源，必须独立重算其 file count、total bytes 与 tree SHA-256，并与真源 manifest 完全一致；不一致时不得上传 ECS 旧树、不得覆盖正在服务的 legacy runtime，也不得在接近满盘的主机上复制完整 staging 目录。此时应使用经审计的流式本地→ECS publisher transport，或另行准备有容量的发布执行环境。
- 完整上传后必须从 OSS 重新读取并校验 manifest 与所有对象的大小和哈希；任一缺失或不匹配均不得选择该 Release。不得复用、覆盖或原地修复已经发布的 Release。
- 完整内容校验由 publisher bridge 的 upload/readback receipt 承担一次。恢复 ECS read role 后，验证必须通过 ECS 上的 read-only bridge，而不是在本机伪造 IMDS 身份；它只需严格读取 manifest、精确比对对象 key 集合、检查全部元数据并读取有上限的代表性对象。不要在每次切换前重复读取整个 Release；全量 read-role 哈希审计属于独立周期性诊断。
- OSS `PutObject` 不具备条件写入语义，不能把对象存储中的可变 `current.json` 当作并发安全的生产指针。单 ECS 的运行时选择使用宿主机 ext4 上受权限保护的 state directory：固定 `flock` 锁、期望 active release、单调 generation、临时文件 `fsync`、原子 rename、目录 `fsync`。desired selection 与 health 后写入的 active receipt 分开保存。
- 回滚仅选择一个已完整复核的旧 Release；先写 desired，再重新挂载并重启容器，健康检查成功后才更新 active receipt。失败的候选不得覆盖此前 active receipt。

## ossfs 与 Podman

- 使用 ossfs 2.0、ECS RAM Role 与同地域内网 endpoint。将固定 Release 前缀挂载到独立的宿主机目录，并以只读 bind mount 提供给容器中的 `/app/course-content/runtime`。
- ossfs 2.0 的配置文件使用 `ossfs2 mount <mount-root>/<release-id> -c <release-id>.conf`；必须显式写入 `--ro=true`、`--allow_other=true`、目标 uid/gid、`--file_mode=0644` 与 `--dir_mode=0755`。不要依赖 ossfs 默认权限，也不要在配置文件中写 AccessKey/Secret。
- 不得将现有 `.staging`、`current`、`previous` 的 rsync/rename 发布算法直接运行在 ossfs 挂载点；OSS runtime Release 永远不依赖目录 rename 原子性。
- 当 ECS 无法同时容纳完整 image tar 与 Podman 解包层时，不得以磁盘 staging、手工管道或删除现有镜像绕过容量。受控流式导入必须先从本地已验证 tar 固定 config image ID、OCI revision 与 layer 字节总量；远端 `GraphRoot` 可用空间必须不少于 layer 总量加 1 GiB。通过该门禁后，同一 SSH stdin 只能同时送入 SHA-256 与 `podman load`，二者结束并精确核对 tar 摘要、image ID 和 revision 后才能激活；空间不足时停止并先扩容。
- 挂载或切换前后都用 `findmnt -T <mount-root>/<release-id>` 确认 FUSE 与 `ro` 选项，并确认容器 bind mount 的只读状态、容器内目录可遍历性，以及应用实际读取 runtime 与教材热索引的 smoke。保留一个已验证 previous release 与其 rollback receipt。
- `resources/textbook-retrieval` 的向量和倒排索引必须在 ossfs 挂载后的实际读取基准下评估。只有可重复的明显退化才允许保留有上限、带哈希和失效策略的本地热缓存；不以形式上的全量对象化牺牲检索性能。

## 发布与删除顺序

1. 记录宿主机和 Podman 的磁盘报告；不要在调查阶段删除 runtime、镜像、tar 或数据库文件。
2. 上传并远端复核候选 Release，演练只读挂载、容器读取、媒体重定向和 rollback。
3. 获得明确的生产切换授权后，执行受锁的 release selection，重启容器并完成 smoke；保存 selection、active receipt 和 rollback 证据。
4. 旧 ECS runtime 只能在成功 smoke 后再次报告空间占用和可用 rollback，并等待人工确认后删除。

删除通过受限脚本执行时，脚本必须在删除前再次确认 active receipt、app 与 worker 的只读 ossfs bind、`readyz` 与独立 rollback Release 的可挂载性。删除目标必须是明确的 non-symlink legacy runtime 目录；使用不跨文件系统、也不跟随 symlink 的遍历删除，使嵌套挂载导致失败而不是被误删。删除后写入不含凭据的 retirement receipt，保留 OSS Release、selector 和 active receipt。

## 失败处理

- RAM Role metadata 不可用、OSS endpoint 不可达、manifest/对象校验失败、挂载非只读、容器 smoke 失败或 active receipt 未写入时，停止切换并保持当前运行时。
- 只有一台 ECS 时，首次发布可短时把该实例切换为受限 publisher RAM Role，但只可在 ossfs 尚未提供生产 runtime 的阶段进行；发布、对象重验与记录完成后必须立即恢复 read-only runtime role。不得在 ossfs 已承载流量期间复用此方式。
- 将 `ali-oss` 发布器打包为独立 Node 运维命令时，`urllib` 的可选 `proxy-agent` 依赖会使 esbuild 静态解析失败。可将该可选模块 externalize，但必须先确认 ECS 无 HTTP(S)/ALL proxy 环境，并在目标 Node 版本上运行一次只读 plan/inspect 验证；不得用该策略绕开真实代理依赖。
- 部署 ECS-side 运维脚本前先读取目标 `python3 --version` 并在该最低版本语法范围内编写。当前 ECS 为 Python 3.6.8：不得使用 `from __future__ import annotations`、内置泛型（如 `list[str]`）、`X | None` 或 `subprocess.run(text=True)`；使用 `typing.List`/`Optional` 与 `universal_newlines=True`。部署后先在 ECS 执行 `python3 -m py_compile`，通过前不得启动发布协议。
- `rtk` 会为节约输出截断长文本行，不能用于判断 OSS object key 是否完整。需要核对协议输出、路径或摘要时，使用不经输出压缩的 `rtk proxy` 或在 bridge 子进程内直接解析；不得把工具展示层的省略号当作远端返回值。
- 当前 ECS 的 `/usr/local/bin/ossutil` 1.7.19 不能可靠处理 stdin，且其 `cat` 会把耗时摘要写到 stdout；它只用于 `ls <prefix> -s` 的独立只读 key-set 交叉检查，不能作为 writer。固定 writer 是经官方下载 ZIP SHA-256 校验的 `/opt/act-ops/ossutil-2.3.0/ossutil`：bridge 每次先从 IMDS 证明唯一 publisher role，再显式传入 `--mode EcsRamRole --endpoint oss-cn-hangzhou-internal.aliyuncs.com --region cn-hangzhou`；普通 `cp -` 会覆盖同名对象，不能用于 immutable Release。为得到 OSS 服务端的禁止覆盖保证，单对象流先写入 root 0700 spool 目录中 0600、不可预测的临时文件（最大 256 MiB、至少保留 1 GiB 磁盘空间），随后仅通过 `api put-object --body file://… --forbid-overwrite true` 写入并立刻重读校验和删除。绝不建立完整 runtime staging。
- ossutil 2 的 `api list-objects-v2 --output-format json` 在单对象页会把 `Contents` 输出为 object 而非 array，bridge 必须规范化缺失、object 与 array 三种形态，并使用 continuation token 完整分页；不得从被截断的 v1 `ls` 行推导 object key。
- 不在远端源码构建，不通过 ECS 代理大型视频，不开启 public-read，也不为排障降低 Bucket 私有访问策略。
