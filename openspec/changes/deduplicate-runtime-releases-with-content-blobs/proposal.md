## Why

当前 v1 immutable runtime release 在 active 与 rollback 前缀中重复存储相同字节。内容寻址 v2 已经建立候选 blob namespace、固定 v1 导入证明、单 runtime bind 与受保护的 lifecycle/GC 基础，但其日常发布和候选验证仍会重复读取约 6.36 GB runtime。这与原 ECS `rsync` 增量同步的可接受部署时长不相容。

本变更保留 v2 的“每个唯一内容一个 blob”布局，改用父 release manifest 继承结论。日常发布只处理 source identity 变化或未知的内容；全量 body audit 改为首迁、异常和低频独立操作。runtime-only 发布也必须与镜像、数据库和 Nginx 发布分离。

## What Changes

- v2 manifest 为每个 Git 管理条目记录 Git blob OID 作为 source identity；以 parent manifest 规划 delta，OID 未变的条目直接继承其 blob SHA、size 与 key，不读取 body、不作 HEAD。
- 本机受控 publisher 使用独立 `act-runtime-oss-release-operator` 身份执行 runtime blob CRUD，并在每个写操作前校验调用者、Bucket、Region 与前缀。ECS 恢复并长期保持 `act-runtime-oss-read`，只执行只读 ossfs、view materialization 与容器操作。
- 新增 Blob 才流式计算 SHA-256/size、上传并 HEAD 验证 metadata；manifest-last、不可覆盖、单发布者锁与可恢复 journal 保持不变。已继承 Blob 的完整性结论来自受保护 parent manifest，full audit 另行运行。
- v2 ECS view 由 parent view 的目录和相对符号链接增量派生，使用 view receipt 复用已完成视图；prepare/select/host verify 不再三次读取全部 body。
- 部署拆分为 `deploy:runtime`、`deploy:app` 与 `deploy:all`。runtime-only 变更不得构建镜像、上传 image tar、导入数据库、执行 Prisma migration 或复制完整 runtime。
- 在不改动生产 selector 前完成候选应用 smoke、一次小增量发布、rollback、容量报告与 v1 退役/GC 准备；生产切换仍要求单独用户授权。

## Capabilities

### New Capabilities

- `content-addressed-runtime-release-storage`: 以 parent-manifest 增量证明、不可覆盖 blob、确定性 logical release manifest、受验证 materialized view 和可达性 GC 管理 runtime release。

### Modified Capabilities

- `oss-runtime-release-management`: 允许 v2 日常发布继承 immutable parent manifest，只验证 changed/unknown blob；full audit 成为独立操作。
- `oss-runtime-deployment-bridge`: 将 v2 view 物化、selection 和 runtime-only 部署从全量 body 校验改为 delta、receipt、mount 和应用 smoke。
- `private-runtime-media-delivery`: 继续只从 active manifest 解析 blob object key；helper 目录不得通过任何公共路径暴露。

## Impact

- 影响 runtime release manifest/publisher/CLI、ECS host materializer/selector、部署脚本、运行手册与自动测试。
- 不改写应用的 Node filesystem runtime 合同，不公开 Bucket，不保存永久 signed URL，不使用 OSS 目录 rename 或 custom FUSE。
- Git 之外的 runtime 内容必须有 Git 跟踪的 external/generated source identity；没有稳定 identity 的文件不得进入增量发布。
- 当前 v2 candidate 的固定 v1 等价性证明是 baseline，而非日常全量验证门禁。
