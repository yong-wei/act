## Context

生产 ECS 已用 RAM Role + 杭州内网 ossfs 挂载 `runtime/blobs/sha256/`，再物化激活 view 给容器。开发工作站按 `developer-oss-runtime-access` 用 `act-runtime-dev-read` 走公网 Endpoint；该 RAM 用户无法限制为「仅当前 active」，且把 OSS AccessKey 分给合作者。阿里云内网 Endpoint 不能从开发机直连。合作者不得持有维护者 SSH、Publisher 或 ECS 角色。

用户已选定：开发机 runtime **与媒体文件体**都经 ECS；身份为一把项目期共享网关令牌；本地保留物化器、`startup:oss-runtime` 与按需 Blob 缓存，只替换公网 ossfs 数据面。

## Goals / Non-Goals

**Goals:**

- 开发启动默认只读生产当前激活 v2 Release，字节只从 ECS 网关进入工作站缓存。
- 合作者权限仅限该网关的 GET；不能 SSH、不能 OSS API、不能发布、不能读候选/历史对象。
- 本地仍暴露只读 `course-content/runtime`，课程/媒体路由与生产学生端观感一致（本机浏览器不直连 OSS）。
- 生产学生短时签名 307、selector、回滚、GC、本机 publisher 公网写入保持不变。

**Non-Goals:**

- 不把合作者接入 VPC/内网 Endpoint，不发 OSS AccessKey，不开放受限 SSH/sshfs。
- 不改生产学生媒体路径，不经 ECS 给学生浏览器中转视频。
- 不在 RAM Policy 中表达 active，不把 runtime 消费者改成 OSS SDK。
- 不热切换已启动 checkout 的 Release，不建第二套逻辑 runtime 命名空间。
- 不在本次把 publisher 写入改为 ECS 内网。

## Decisions

### 1. 在 ECS 用「签发时 active、使用时按租约」网关，而不是给开发机内网 OSS

网关不向合作者暴露 OSS。它只读宿主机 active receipt、对应不可变 manifest/receipt，以及 ossfs Blob 根上的文件。OSS 内网流量只发生在现有 ossfs。

**签发时 active：** `startup:oss-runtime` 先用 readiness 钉住身份，再向网关申请读取租约。仅当该 identity 与当时 host active receipt 的 Release ID、manifest digest、tree digest 完全一致时才签发。候选、回滚或任意历史身份不能换成租约。

**使用时按租约：** Blob GET 携带租约。允许集是签发时冻结的 manifest SHA 集合，不随后来的生产切换改写。因此生产从 A 切到 B 后，仍在跑的 checkout 可以按需读取 A 中尚未缓存的 Blob；新启动只能租 B。冻结允许集的租约持续到该 checkout 停止或共享令牌被轮换；墙上时钟 TTL 不得在 checkout 仍存活时结束租约。传输凭证可以短 TTL，但只能对同一存活租约续期，续期不得改 Release、不得改允许集、也不得要求 A 仍为 active。

Blob 仍从 ossfs 前缀按 digest 读取。digest 不在该租约允许集中则拒绝，即使文件在 FUSE 上或属于新的 active。对象缺失则失败关闭，不换 digest。

备选：网关永远只服务「此刻 active」——会打破已钉住 checkout 的按需读取。备选：VPN 直连内网 OSS——无法做签发时 active-only，且要分发连接凭证。

### 2. 认证是一把共享 Bearer 令牌，不是 SSH、不是 RAM 用户

仓库外文件保存网关 URL 与令牌（目录 `0700`、文件 `0600`）。ECS 用独立 `0600` 令牌文件做恒定时间比较。撤销 = 轮换 ECS 令牌并确认旧令牌失败。不做每人令牌、不做 GitHub OIDC（本次选定共享令牌）。

Readyz 仍可匿名发现 identity；**内容**必须带令牌。匿名 GET Blob 必须失败。

### 3. 工作站用「网关 HTTP FUSE + 磁盘缓存」替换 ossfs2

保留 Linux/WSL2/Lima 运行层、物化器、checkout bind 与共享缓存拓扑。Blob 根改为对租约绑定的 `GET .../blobs/sha256/<sha>` 的只读 FUSE（支持 Range）。仅允许该 checkout 租约冻结的 manifest digest。不再要求 ossfs2/ossutil/公网 Endpoint 作为默认启动依赖。

备选：每次启动拉完整 view——与选定的按需缓存不符。备选：应用反代全部 I/O——要改 Node fs 合同。

### 4. 开发媒体走本地物化文件，不走公网签名

开发进程不配置 `ACT_RUNTIME_OSS_RAM_ROLE`。媒体由本机从 `course-content/runtime` 提供；首次未命中缓存时 FUSE 经网关拉字节（含视频）。生产 `/api/course-runtime/assets` 的 307 签名行为不变。

### 5. 网关部署在生产 ECS，经 TLS 反代，与学生站点隔离

本机回环监听 + 现有反代的独立路径或子域；限流、禁查询串令牌、不把令牌写入日志。网关失败不得影响学生 ossfs 与 app 容器。部署属 `server-ops`，须单独授权。

## Risks / Trade-offs

- [开发看课会把视频经 ECS 出站] → 按 SHA 磁盘缓存、HTTP Range、限流与最大并发；令牌可立刻作废。
- [共享令牌被泄露等于可读当前激活整树] → 比现行 OSS AK 窄（无历史/候选、无写）；仍须仓库外保存与轮换。
- [网关或 ECS 过载影响开发启动] → 与学生面隔离、超时失败关闭、不回退公网 OSS。
- [生产 blob ossfs 挂的是整个 sha256 前缀] → 无租约或 digest 不在租约允许集中一律拒绝，禁止「文件在 FUSE 上就可下载」。
- [生产切换后 A 的 Blob 已被 GC] → 该 digest 读取失败关闭，不换对象；日常 GC 仍须保留 rollback/retained 根，直到存活开发租约结束。
- [旧合作者仍持有 `act-runtime-dev-read`] → 默认启动拒绝公网 ossfs；文档要求停用 AccessKey（删除 AK 仍须维护者在控制台执行）。

## Migration Plan

1. 实现网关与开发适配器的离线契约测试（签发租约、允许集、Range、拒绝非租约 SHA、A→B 切换后未缓存 A Blob 仍可读、切换后不能新签 A）。
2. 获 `server-ops` 授权后在 ECS 部署网关与反代，写入仓库外令牌；用一份令牌做真实 smoke。
3. 切换 `startup:oss-runtime` 默认数据面；更新合作者文档；经密码管理器分发网关令牌（不含 SSH/OSS AK）。
4. 确认新启动不再访问公网 OSS Endpoint；再停发并计划删除 `act-runtime-dev-read` AccessKey。
5. 回滚：ECS 下线网关路径；开发启动失败关闭（不自动回到公网 ossfs）。学生 runtime 不受影响。

## Open Questions

无。范围、共享令牌、按需网关缓存已由需求方选定。
