## Why

当前不可变 runtime release 以完整目录前缀保存。生产 active 与 rollback 两个 release 共占 12,286,210,506 bytes；按内容哈希去重后为 6,359,383,407 bytes，可释放 5,926,827,099 bytes（48.24%）。20 GB Bucket 在保留发布中的新 release、active 与 rollback 时没有足够余量。

`ossutil sync` 只能在同一可变目标前缀内跳过未变化文件，不能安全地把旧 release 中的对象重用于新的 immutable release。本变更建立内容寻址 blob 库、release manifest 和受验证的宿主 materialization，使相同字节跨 release 只保存一次，同时保持应用现有的 filesystem runtime 合同。

## What Changes

- 新增内容寻址 runtime blob 存储：每个普通文件按 SHA-256 写入只可新增的 blob key；v2 `runtime/blob-releases/<release-id>/` 仅保存不可变 logical manifest 与 receipt，并与既有 v1 `runtime/releases/<release-id>/` 分离；manifest 将逻辑路径、size、SHA-256 与 blob key 绑定为一个可验证的逻辑 runtime 树。
- 新增受验证的 release materialization：在 ECS 上从 active/rollback manifest 生成临时逻辑目录视图，完成完整性验证后原子选择该视图；应用仍以只读 `/app/course-content/runtime` 读取，不感知 blob layout。
- 新增 release 生命周期与 GC 规则：发布、materialization、activate、rollback 与 GC 使用同一把宿主锁；仅从 immutable protected manifest 的可达 blob 集合决定删除，失败或并发状态不得删除 active、rollback、发布中或有 receipt 引用的对象。
- 保持 OSS Bucket 私有、ECS RAM Role 短期凭据、ossfs 与容器 bind 只读、浏览器短时媒体 redirect 和现有 v1 release rollback。迁移期间 ECS 可持有前缀受限的 operator role；该变更不授权生产切换或删除任何现有 release。
- 首次完整 v2 候选允许从一个已固定且已验证的 v1 Release 导入，而不是虚构“Git tree 已完整覆盖生产 runtime”。导入器必须逐对象重读、重算哈希并产出完整等价性证明；常规后续 v2 发布仍只接受 `origin/integration` 可达 Git tree。
- 为 blob 去重率、manifest 完整性、materialization 等价性、热索引性能、故障恢复、并发发布/GC 和 rollback 增加可复验工件与自动测试。

## Capabilities

### New Capabilities

- `content-addressed-runtime-release-storage`: 以不可覆盖 blob、确定性 logical release manifest、受验证 materialization 和可达性 GC 管理 runtime release 的跨版本字节复用。

### Modified Capabilities

- `oss-runtime-release-management`: 扩展 v1 release-prefix 发布合同，使 v1/v2 manifest 可并存，v2 以跨 release 的 append-only blob 与 manifest-last 方式发布。
- `oss-runtime-deployment-bridge`: 扩展直接 release-prefix 挂载合同，使通过 qualification 的 v2 host materialized view 可与 v1 共存，并明确 desired、active 与 rollback 的持久状态迁移。
- `private-runtime-media-delivery`: 使 active manifest 对媒体 object key 的 allowlist 同时支持 v1 release-prefix key 和 v2 blob key，且仅 active identity 可签名。

## Impact

- 影响 `src/lib/runtime-release*.ts`、ECS publish bridge、runtime release CLI、ossfs/systemd materialization、release locator、媒体 object resolver、部署与 rollback 工具及其测试。
- 影响 `act-course-assets/runtime/` 的对象布局和 ECS 的本地受控 materialization/cache 空间；不改变应用内 `/app/course-content/runtime` 路径或私有 Bucket 策略。
- 不新增长期 AccessKey/Secret，不引入自定义 FUSE；是否采用宿主 symlink forest 取决于 runtime callsite 与 ossfs 语义等价性验证，未通过则保持当前 release-prefix 设计并另行评估 Bucket 扩容。实施前必须先归档 `migrate-runtime-to-oss-immutable-releases`，使本变更的 capability delta 有唯一主 spec 基线。
