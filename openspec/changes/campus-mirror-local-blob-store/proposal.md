## Why

生产正在形成双镜像形态（阿里云 `121.40.124.135` + 校内 `202.195.195.153` / `act.just.edu.cn`）。校内服务器出站 TCP 全禁且公网入站被拦，无法直读 OSS，课程内容依赖随行副本；首次克隆走 ECS 解引用快照（一次性全量，慢且不可增量）。校内带宽充足免费、发布机位于校园网内，需要一个与 OSS 平行的同 manifest 增量投递通道，使校内 runtime 同步与阿里云完全解耦。

## What Changes

- 新增校内 runtime 投递能力：校内本地 CAS blob-store（`sha256/` 只增不删）、manifest 直推、复用现有 materializer 以本地目录为 blob root 进行物化、校内 activate 与 smoke、独立的校内 active receipt。
- 发布流新增校内目标（`runtime:publish` 的姊妹命令或 `--target campus`）：从发布机按 manifest 填充 blob 并直推校内，与 OSS 条件 PUT 通道使用同一份不可变 manifest、各自独立事务，互不阻塞。
- 首次落地包含一次结构重建：把本次解引用快照换成本地 blob-store + 链接 view + 选择器的标准结构，此后进入按哈希命名的纯增量同步。
- 应用镜像走既有双镜像规则（server-ops skill 已更新）：本机构建 tar 双端装载核验完成前不删除；本次首次克隆为一次性例外，镜像取自阿里云导出 tar（原本机构建镜像已清理），非本机二次构建。
- 不修改 OSS 通道任何现有合同：`oss-runtime-release-management` 与 `content-addressed-runtime-release-storage` 的 requirements 不变，校内通道作为平行消费者复用 CAS manifest 合同。

## Capabilities

### New Capabilities
- `campus-mirror-runtime-delivery`: 校内镜像站的 runtime 投递——本地 CAS blob-store 生命周期、同 manifest 直推、本地物化与激活、双端 receipt 分账与验收证据。

### Modified Capabilities

## Impact

- `scripts/runtime-release/`：新增校内投递命令与本地 blob-store 装载逻辑；materializer 复用 `blob_root` 参数化路径，不改动其合同。
- 校内服务器 `202.195.195.153`：新增 `data/runtime/blob-store` 与 view 目录约定、只读 bind、激活单元。
- `.agents/skills/server-ops/`：双镜像规则已先行更新，实施时与本变更对齐。
- 不影响数据库链路、应用镜像构建链路与 OSS 发布合同。
