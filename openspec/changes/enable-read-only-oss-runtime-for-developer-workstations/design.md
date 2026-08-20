## Context

生产 runtime 已采用 v2 内容寻址布局：不可变 manifest/receipt 位于 `runtime/blob-releases/<release-id>/`，文件字节位于 `runtime/blobs/sha256/<sha256>`。生产 ECS 通过 `act-runtime-oss-read` 和 ossfs2 只读挂载 Blob namespace，再由 `materialize-runtime-blob-release.py` 生成兼容现有 Node `fs` 消费者的逻辑视图。应用仍从 `course-content/runtime` 读取，不理解 OSS object key。

合作者的仓库副本没有完整 runtime。现有本机 Publisher 具备独立写身份和受控发布路径，但该身份不能用于开发分发；现有 ossfs 配置也固定使用 ECS IMDS 与杭州内网 Endpoint。生产 active authority 只存在于 ECS lifecycle/active receipt，OSS 不维护可变 `current` 对象，当前 `/api/readyz` 也不返回 runtime 身份。

开发工作站包含 Linux、Windows 和 macOS。ossfs2 只提供 Linux 运行路径，因此 Windows 使用 WSL2，macOS 使用 Lima/Colima Linux VM，应用、FUSE 挂载和物化器必须运行在同一 Linux 环境。用户接受一个项目期共享 RAM 用户：它不能提供个人审计，且技术上可以读取策略覆盖的历史或候选 v2 对象；服务层仍只选择生产 active Release。

## Goals / Non-Goals

**Goals:**

- 让合作者在启动本地服务时按需读取生产 active v2 runtime，而不复制 OSS 数据或等待人工资源包。
- 复用现有只读 Blob 挂载、物化器和 `course-content/runtime` 文件系统合同。
- 使 active 身份发现、manifest 校验、挂载、物化、启动和停止具备失败关闭、幂等和可诊断行为。
- 使用可在项目结束时统一撤销的最小只读 RAM 用户，并提供不含凭据值的接入与撤销文档。

**Non-Goals:**

- 不复用或下放 Publisher、ECS operator、生产 selector、回滚或 GC 权限。
- 不在 RAM Policy 中声称动态理解“active Release”；active 选择由 readiness 与本地启动事务约束。
- 不支持 macOS/Windows 原生 FUSE，不在 Docker Desktop 应用容器内单独运行 ossfs2。
- 不把 runtime 消费者改写为 OSS SDK，不建立资源下载包、公共 Bucket、永久签名 URL或开发同步网关。
- 不在运行中的开发服务内热切换 Release，不自动创建、显示或分发真实 AccessKey/Secret。

## Decisions

### 1. Readiness 投影生产 active 身份，但不成为新 selector

`/api/readyz` 使用现有 active manifest/receipt 校验路径增加 `runtime` 探针。生产 blob-view 模式要求 runtime ready；只有本地物化 manifest 与 active receipt 的 Release ID、manifest digest 和 tree digest 一致时，响应才返回最小 identity。desired/candidate divergence、缺失 receipt、未知 schema 或 digest 漂移使 runtime readiness 失败，不得投影候选身份。

非 blob-view 的普通本地启动保持兼容：runtime 探针标记为不要求，identity 为 `null`，不会伪造 active Release。公开响应只包含 readiness 布尔值、manifest schema、Release ID、manifest digest 和 tree digest，不包含对象 key、逻辑路径、source revision、凭据、签名 URL或内部挂载路径。

选择该方案而不是 OSS `current.json`，因为生产 active receipt 已是现有权威，且仓库明确不依赖缺少 CAS 的可变 OSS selector。选择现有 readiness 而不是新增带 Token 的接口，是因为投影仅含不可变身份，开发工具无需管理第二组秘密。

### 2. 开发身份是专用共享 RAM 用户，不是 Publisher 或 ECS Role

创建 `act-runtime-dev-read` RAM 用户并生成一组项目期 AccessKey/Secret。自定义策略只允许：

- 对 `act-course-assets/runtime/blob-releases/*` 与 `act-course-assets/runtime/blobs/sha256/*` 执行必要的对象读取；
- 仅在 ossfs2 确实需要时，对 Bucket 执行带上述 prefix 条件的 `ListObjects`。

策略不包含 Put、Delete、Copy、Multipart、ACL、Bucket 管理、RAM、STS、控制台浏览或生产主机权限。默认拒绝即为写入拒绝，不增加广泛 `oss:*` 后再用不完整 Deny 修补。启动前通过 `GetCallerIdentity` 校验固定账号与 `user/act-runtime-dev-read` principal；不得接受 Publisher principal。

选择静态 RAM 用户而不是共享 AssumeRole，是因为 ossfs2 在非 ECS 环境中最稳定的长期挂载输入是 AccessKey/Secret，短期 STS 会引入续期和 FUSE 重挂载状态。该权衡只适用于当前短期、可信合作者场景；项目结束必须删除 AccessKey 和 RAM 用户。

### 3. 凭据保存在统一 Linux 运行层的仓库外受限文件中

凭据通过密码管理器或端到端加密渠道分发，在 Linux 运行层内由交互式安装命令写入 XDG config 目录；父目录必须为 `0700`，凭据文件必须为非符号链接 regular file 且模式为 `0600`。启动工具拒绝仓库内路径、`.env`、组/其他用户可读文件、未知字段和 Publisher identity。

脚本、日志、诊断 JSON、OpenSpec、示例配置和错误输出不得包含 AccessKey ID、Secret 或环境变量值。文档只包含 RAM Policy 模板、保存命令、凭据管理器条目名称和撤销步骤。AccessKey ID 只在阿里云控制台/密码管理器中作为运维标识保存，不进入仓库。

### 4. 所有平台使用同一 Linux 挂载与应用运行合同

Linux 原生直接运行；Windows 在 WSL2 中运行；macOS 在 Lima/Colima Linux VM 中运行。预检要求受支持的架构、`/dev/fuse`、ossfs2、ossutil、`mount`/`findmnt`、Python 3、Node 与仓库可写状态目录。应用源码、Blob mount、materialized view 和 Next.js/worker 进程位于同一 Linux 命名空间。

工作站使用杭州公网 OSS Endpoint；内网 Endpoint 仅属于 ECS。Docker Desktop 中的特权 FUSE 容器、macFUSE、WinFSP 和不同平台的多套 mount adapter 均不属于首版范围。

### 5. 启动事务固定一个经过双重绑定的 active Release

开发启动适配器按以下顺序执行，并持有每个 checkout 的本地排他锁：

1. 通过 HTTPS 读取生产 `/api/readyz`，严格解析 runtime identity；响应不可用、runtime 不 ready 或字段未知时失败。
2. 以只读 RAM 用户读取该 Release 的 v2 manifest 和 receipt，校验 schema、Release ID、canonical manifest digest、wire/receipt 绑定、tree digest、文件集合与确定性 Blob key。
3. 以公网 Endpoint 将 `runtime/blobs/sha256/` 挂载到 XDG state/cache 根下，要求 FUSE 和只读 mount options；不得把整个 Bucket 暴露给应用。
4. 调用现有物化器执行 prepare、helper attach、verify 与 select，在 XDG state 根中生成/复用与 manifest identity 精确绑定的 view。
5. 以只读 bind mount 将选中 view 覆盖到当前 checkout 的 `course-content/runtime`，再调用现有 `npm run startup`。源目录内容只被 mount 临时遮蔽，不删除、不覆盖、不提交。
6. 写入不含凭据的开发 selection receipt，记录 readiness identity、manifest identity、mount/view 路径和启动时间。运行期间不再次查询或切换 Release。

重复启动在 identity、receipt、FUSE mount、view 和 bind 全部匹配时复用现有状态；任一项漂移先停止并清理未被运行进程使用的局部状态，再重新准备。manifest 缺失、Blob 不可读、写权限未被拒绝、物化校验失败或 bind 非只读时均不得启动，也不得回退到目录排序、候选 Release、旧资源包或 checkout 中的残留 runtime。

### 6. 停止流程先结束消费者，再卸载开发 runtime

`npm run shutdown` 的开发 OSS wrapper 先停止 frontend、worker 和 scheduler，再卸载 checkout bind 和 Blob FUSE。它只处理由当前 checkout receipt 证明拥有的精确 mount，不递归清理未知路径。崩溃后下次启动通过 receipt、mount source 和进程检查恢复或报告人工清理命令。

### 7. 文档与凭据分开发放

仓库提供一份可分发的合作者接入文档，覆盖 Linux/WSL2/Lima 准备、安装命令、启动/停止、身份验证、常见故障和撤销后清理。真实凭据由用户在实现与真实 smoke 通过后，通过受控密码管理渠道单独共享；仓库、Issue、PR、聊天记录和文档均不承载 Secret。

## Risks / Trade-offs

- [共享凭据无法进行个人审计，且开发者可绕过工具读取策略覆盖的 v2 namespace] → 仅授予只读最小前缀、限定可信合作者、保存分发名单，并在项目结束或成员退出时统一撤销和换钥。
- [公网 OSS 读取产生延迟、流量和费用] → 使用 ossfs2 按需读取与本地缓存，启动时只获取 manifest/receipt；性能不足时先记录证据，再启用 digest-bound 热缓存。
- [FUSE、bind mount 和 sudo 在 WSL2/Lima 中存在环境差异] → 使用单一 Linux 预检和真实三平台 smoke，不维护多个原生 adapter。
- [开发启动期间生产 active Release 发生变化] → 一次启动只信最初 readiness identity；manifest 与该 identity 不一致即失败，下一次启动重新解析。
- [公开 readiness 增加部署身份元数据] → 严格字段 allowlist，不返回路径、source revision、对象 key 或 Secret；保留 `Cache-Control: no-store`。
- [静态 AccessKey 泄露影响所有合作者] → 仓库外 `0600` 保存、禁止日志、密码管理器分发、可立即删除 AccessKey，并提供无凭据值的应急撤销步骤。
- [bind mount 临时遮蔽 checkout runtime] → 持有 checkout 锁、验证 mount ownership、停止消费者后精确卸载，绝不删除被遮蔽目录。

## Migration Plan

1. 先实现并测试 readiness runtime identity；部署后确认生产 active/receipt 漂移会返回 503，普通本地模式保持兼容。
2. 实现 Linux 开发 mount/物化/start/stop 适配器及完全模拟的失败关闭测试，不配置真实凭据。
3. 由用户在阿里云控制台创建 `act-runtime-dev-read` Policy、RAM 用户和唯一 AccessKey，并立即保存到密码管理器；先在一台受控 Linux 环境验证读取允许、写入拒绝、active identity、只读 mount、课程/教材 smoke 和清理。
4. 在 WSL2 与 Lima/Colima 执行相同 smoke；通过后分发无 Secret 的接入文档，并通过密码管理器单独授予凭据。
5. 项目结束、凭据疑似泄露或合作者退出时，先删除 AccessKey，再确认开发挂载失败，最后删除 RAM 用户/策略绑定并清理本地 credential 文件和 mount。

回滚不影响生产 runtime：撤销 AccessKey、停止开发 wrapper 并卸载本地 mount 即可。readiness 新字段保持向后兼容；若需撤回，先停止分发，再移除客户端依赖和响应字段。

## Open Questions

无。真实 RAM 创建、AccessKey 显示与合作者授权属于实现完成后的用户操作，不在 proposal 阶段执行。
