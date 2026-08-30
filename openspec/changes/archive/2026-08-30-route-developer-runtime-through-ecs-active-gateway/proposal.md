## Why

开发工作站今天用共享 RAM 用户直连杭州公网 OSS，既能读历史/候选 Blob，也拿不到 ECS 内网路径。合作者不应获得 SSH、Publisher、OSS AccessKey 或 ECS 角色，但启动本地服务后必须只读到**当前激活** runtime，且页面与媒体体验贴近生产。RAM 策略无法表达「仅 active」，因此必须把授权收口到 ECS 上的激活视图。

## What Changes

- **BREAKING（开发接入）**：废弃工作站公网 ossfs / `act-runtime-dev-read` AccessKey 作为默认数据面。`startup:oss-runtime` 默认经 ECS 激活网关按需取 Blob，再走既有物化器与 `course-content/runtime` 只读 bind。
- 在生产 ECS 增加最小权限「激活 runtime 读网关」：仅当请求的身份与当时 host active receipt 一致时签发读取租约；租约冻结该 v2 manifest 允许集，供已启动 checkout 按需取 Blob。拒绝从未激活过的候选/历史身份、任意 key，以及无租约的对象读取。OSS 内网读写仍只发生在 ECS，使用现有 `act-runtime-oss-read` + ossfs，不把该角色或内网 Endpoint 分发给合作者。
- 合作者只持有一把项目期共享网关令牌（仓库外、可整体撤销）。令牌不能 SSH、不能调 IMDS、不能发 runtime、不能 List/Get 非激活对象。维护者的 SSH 与 Publisher 凭据仍不分发。
- 开发机上的 runtime 文件体与媒体文件体都经该网关进入本地按需缓存后，由本机服务按生产相同路由/文件系统合同提供；开发浏览器不直连公网 OSS。生产学生端既有短时签名 307 不变。
- 更新合作者文档与撤销步骤；实现并部署网关前不得分发新令牌。本机 publisher 的公网写入路径不在本次范围。

## Capabilities

### New Capabilities

- `ecs-active-runtime-developer-gateway`: 定义 ECS 上仅针对签发时 host-active Release 的只读网关：共享令牌、pin-time 租约、冻结允许集、传输与失败关闭，以及不得暴露的主机/OSS 权限边界。

### Modified Capabilities

- `developer-oss-runtime-access`: 将工作站默认数据面从公网 OSS + RAM 用户改为经 ECS 激活网关的按需 Blob 缓存；保留 readiness 钉住、物化器、checkout bind 与共享缓存拓扑。

## Impact

- 影响 `scripts/runtime-release/developer-oss/`、`startup:oss-runtime` / `shutdown:oss-runtime`、开发凭据安装、合作者文档，以及生产 ECS 上的网关进程与反向代理配置。
- 开发媒体不再依赖本机 `ACT_RUNTIME_OSS_RAM_ROLE` 或公网签名 URL；本地应用从已物化/已缓存的激活视图读字节。
- 不改变生产 selector、回滚、GC、学生媒体签名、Publisher 身份，也不向合作者开放 SSH 或 OSS AccessKey。
- 开发按需拉取视频会占用 ECS 出站带宽；须限流、按 SHA 缓存，并允许统一撤销令牌。
