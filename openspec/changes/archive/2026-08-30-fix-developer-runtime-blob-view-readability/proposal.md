## Why

macOS Lima 开发运行时能够完成 active Release 选择并启动服务，但物化视图中的 `.act-runtime-blobs` 内容文件可能对应用进程不可读，且已发布 manifest 中的治理工件可能未完整出现在逻辑视图。应用随后把文件系统交付故障误判为业务资源缺失，使已经同步到数据库的微辅导仍返回 `RESOURCE_UNAVAILABLE`。

## What Changes

- 在启动消费者前逐项验证 manifest 声明的逻辑文件、相对 Blob 链接、目标可读性、大小与 SHA-256，并验证关键治理工件完整进入视图。
- 统一 Lima 共享 Blob 挂载、物化视图和应用进程的 UID/GID 与遍历/读取权限合同；权限不足时停止启动，不留下表面 ready 的半可用运行时。
- 让 `/api/readyz` 暴露不含凭据的 runtime 文件系统验证状态和固定 Release 身份，禁止仅凭挂载存在报告 ready。
- 增加微辅导治理工件 smoke：v2 baseline、选项归因、资源投影和验证题注册表必须可读且身份一致。
- 提供精确清理、重建和回滚流程，不修改 OSS 不可变 Release，也不覆盖用户工作区。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `developer-oss-runtime-access`: 强化开发工作站 runtime 物化后的文件可读性、工件完整性、启动门禁与健康证据。

## Impact

- 影响 Developer OSS/Lima bootstrap、共享挂载与物化器、checkout bind、启动/停止脚本、runtime readyz 投影及本地 smoke 测试。
- 不修改微辅导业务编排、数据库模型、生产 active Release、OSS 对象或发布选择器。

