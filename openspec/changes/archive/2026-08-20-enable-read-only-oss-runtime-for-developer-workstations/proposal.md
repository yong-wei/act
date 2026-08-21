## Why

合作者当前无法在各自开发环境中读取已发布到私有 OSS 的完整教学 runtime，只能依赖过期的本地文件或人工资源包，因而无法及时验证服务对最新生产内容的兼容性。项目周期即将结束，需要一个可统一撤销、无需复制完整 OSS 数据、且复用现有文件系统 runtime 合同的短期开发接入方案。

## What Changes

- 在 `/api/readyz` 增加最小化的生产 active runtime 身份投影，只在本地 active receipt 与物化 manifest 完全一致时返回 Release ID、manifest digest 与 tree digest；不返回对象路径、凭据或候选身份。
- 为 Linux、Windows WSL2 与 macOS Linux VM 提供统一的开发启动流程：使用公网 OSS Endpoint 和专用共享只读 RAM 用户挂载 v2 Blob namespace，验证 readiness 指定的不可变 manifest，物化逻辑 runtime view，并只读接入 `course-content/runtime`。
- 每次开发服务启动固定一个生产 active Release，运行期间不自动切换；生产更新在下一次启动时生效，失败或身份漂移时不回退到目录排序、候选 Release 或本地残留内容。
- 提供最小 RAM Policy、RAM 用户创建、凭据保存、分发、撤销及故障处理文档；凭据值不得进入 Git、`.env`、日志、OpenSpec、示例配置或诊断工件。
- 增加 readiness、manifest/receipt 校验、只读挂载、跨平台 Linux 运行层、重复启动/清理和写权限拒绝的自动化与人工 smoke 验证。

## Capabilities

### New Capabilities

- `developer-oss-runtime-access`: 定义开发工作站以共享项目期只读身份发现、挂载、验证并固定生产 active OSS runtime 的安全与运行合同。

### Modified Capabilities

- `content-addressed-runtime-release-storage`: 将已验证的 active blob-backed runtime 最小身份投影到 readiness，供开发工作站精确发现生产 Release，同时保持 desired/candidate 隔离。

## Impact

- 影响 `/api/readyz`、active runtime manifest/receipt 读取、开发启动脚本、ossfs2 配置、现有 runtime 物化器、测试和运维文档。
- 需要在阿里云 RAM 中创建独立只读用户及自定义策略，并通过仓库外的受控渠道分发一组项目期 AccessKey/Secret。
- 不修改 Publisher 身份或写入协议，不复制 OSS Bucket/前缀，不把应用 runtime 消费者改写为 OSS SDK，也不改变生产 selector、回滚、GC 或媒体签名权限。
