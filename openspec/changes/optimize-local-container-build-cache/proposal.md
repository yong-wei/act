## Why

ACT 的本机发布镜像构建把约 1 GB 的 Chromium、LibreOffice 和系统库层绑定在应用 builder 之后，并将 BuildKit 导出缓存放在各自工作树内。普通源码变更和工作树切换因此会重复下载、安装与导出本应稳定的系统层，也会让冷构建中的系统安装与 Next.js 编译争用资源。

## What Changes

- 将生产 runner 的系统依赖拆为不读取应用源码、builder 工件或 `APP_REVISION` 的 `runner-os` 阶段。
- 固定 Node 基础镜像 digest，并用显式 `BUILD_OS_REV`、`RUNNER_OS_REV` 分别控制构建工具层和运行系统层刷新；普通应用提交不得隐式吸收新的基础镜像或 apt 状态。
- 为 npm 与 Prisma BuildKit cache mount 设置按目标平台隔离的稳定 ID。
- 将本机构建缓存移到所有 ACT 工作树共享的主机缓存根，拒绝任何位于已登记 Git 工作树内的配置，按目标平台隔离，并使用单写锁和失败安全的 generation/current 指针发布缓存。
- 使用固定命名的本机 buildx builder，使稳定 cache-mount ID 在不同工作树之间实际落入同一 BuildKit 实例。
- 将本机构建改为先顺序预热 `runner-os`、再构建最终镜像，避免冷系统安装与 Next.js 编译并行。
- 将 local cache exporter 固定为 `mode=max`，使依赖、builder 与 runner-os 中间层能够跨工作树复用。
- 新增静态合同测试与脚本级回归测试，证明层依赖、缓存目录、锁、平台隔离和预热顺序。
- 本变更不移除宿主机的完整 Next.js 预构建，也不缩小 Docker build context；这两项分别进入后续变更，避免同时改变发布验证真源和运行时输入分母。

## Capabilities

### New Capabilities

- `local-container-build-cache`: 定义 ACT 本机发布镜像的稳定系统层、跨工作树平台隔离缓存、单写发布和顺序预热合同。

### Modified Capabilities

无。

## Impact

- 影响 `Dockerfile`、`scripts/build.sh`、构建合同测试与相应 npm 测试入口。
- 不改变最终镜像内容、OCI revision、镜像 tar、provenance sidecar、远端装载/启停流程、OSS Runtime Release 或 selector 激活流程。
- 本机首次构建仍需下载系统依赖；后续同平台构建可复用稳定层。基础镜像或系统补丁升级必须显式修改版本化输入。
