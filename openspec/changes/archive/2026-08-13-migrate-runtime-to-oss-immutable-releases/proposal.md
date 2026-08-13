## Why

生产 ECS 的 `course-content/runtime` 约占 5.9 GB，并且现有部署会同时保留 staging 和 previous 副本，放大根文件系统压力。课程媒体仍混有易失效外链，当前运行时又依赖本地文件系统，不能用一次 SDK 改造替代现有读取合同。

## What Changes

- 新增不可变的 `act-runtime-release.v1`：为一份 runtime 树生成确定性文件清单、逐文件 SHA-256、总量与树摘要，并发布到 `oss://act-course-assets/runtime/releases/<release-id>/`。
- 新增 release 的发布、远端验证、检查、选择与回滚工具；未完成上传、对象集合漂移或摘要不符时不得更新期望 release selector。
- 将 ECS 运行时部署改为 ossfs 2.0 只读、固定 release-prefix 挂载，并把经过验证的挂载路径只读绑定到 `/app/course-content/runtime`；移除生产主机 runtime 的 rsync/staging/previous 复制流程。
- 为媒体资源增加 `objectKey`、内容哈希和大小元数据，保留已有外链作为 legacy fallback；新增只允许已发布媒体对象的短时签名重定向，禁止向浏览器提供永久 OSS URL。
- 增加 runtime release、部署、路径安全、回滚、媒体兼容性与私有访问的自动验证，并记录生产迁移与回滚检查表。旧 ECS runtime 的删除不属于本变更的自动动作，必须在生产 smoke 与人工确认后另行执行。

## Capabilities

### New Capabilities

- `oss-runtime-release-management`: 生成、发布、验证、检查和回退私有 OSS runtime release，保持内容身份可复现且不完整发布不可选。
- `oss-runtime-deployment-bridge`: 用 ECS RAM Role 和 ossfs 2.0 将经过验证的 immutable release 以只读文件系统提供给 Podman，不依赖 OSS 目录 rename。
- `private-runtime-media-delivery`: 将已发布课程媒体的 object metadata 映射到服务端短时签名重定向，同时保持 legacy URL 兼容。

### Modified Capabilities

- 无。

## Impact

- 新增 runtime release 库、命令行工具、manifest 与测试夹具。
- 修改 `scripts/remote-deploy.sh`、`deploy/podman/` 的 runtime 选择合同和远端运维脚本。
- 修改课程 runtime 媒体投影与 `/course-runtime` 资产访问边界，增加私有媒体 resolver。
- 新增 `@alicloud/credentials` 与 `ali-oss` 的受限生产依赖；不会在仓库、脚本或环境文件中写入长效 AccessKey/Secret。
- 更新 `server-ops` 技能，沉淀经验证的 OSS/RAM Role/ossfs 运维规则。
