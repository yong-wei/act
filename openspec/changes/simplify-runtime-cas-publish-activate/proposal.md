## Why

日常 Runtime 发布的数据面已经是 SHA-256 CAS 与不可变 manifest，但控制面仍依赖 parent、receipt、lifecycle、host state、cutover 和全量校验。这些协议把未变化事实反复证明一遍，使发布成本退化成全量读取与远程预检。应用部署与 Runtime 发布已经拆开，现在应把控制面砍回最小模型。

## What Changes

- **BREAKING**：日常发布改为单一增量 Publisher。本地 SQLite 记录 path/size/mtime_ns/sha256；只对 metadata 变化的文件计算哈希；对新内容做条件 PUT。`parent`、parent receipt、全量 HEAD/回读不再参与日常发布。
- **BREAKING**：生产激活只保留 `current` 与 `previous`。新 release 只确认 Δ Blob 与少量 sentinel，物化后原子切换；回滚交换两个指针。
- **BREAKING**：删除旧发布控制平面：publisher bridge 编排、复杂 lifecycle、host state、publisher-shadow、历史 cutover/migration 脚本，以及发布热路径上的 source-proof / bundle parent 资格条件。
- 全量校验与 GC 移出热路径。只保留独立 `runtime:doctor --full` 与 `runtime:gc`；publish / activate / 应用部署不得隐式调用。
- 作者态 `export_runtime.py` 对内容未变的文件不重写，避免无意义 mtime 变化触发重新哈希。
- 运维入口收敛为 `runtime:publish`、`runtime:activate`、`runtime:rollback`、`runtime:doctor`、`runtime:gc`。`remote-deploy.sh` 只做应用部署；删除 `DEPLOY_SCOPE=all` 的空 fail-closed 分支。
- 不升级 manifest 协议，不建设自动 parent，不建设外部 bundle 增量谱系，不建设作者态依赖失效图。

## Capabilities

### New Capabilities

- `runtime-cas-publish-activate`: 日常 CAS 增量发布、current/previous 激活、独立 doctor/GC，以及作者态落盘去抖动。

### Modified Capabilities

- `oss-runtime-release-management`: 日常完整性改为 Δ hash + 条件 PUT；回滚改为 current/previous 互换；删除 parent/HEAD/全量回读资格。
- `content-addressed-runtime-release-storage`: 增量改为本地索引与 CAS hit；lifecycle 压成两指针；GC 不再挂发布链。
- `oss-runtime-deployment-bridge`: 宿主机选择从 desired/active/generation 改为 current/previous。
- `content-knowledge-runtime-release-toolchains`: Runtime 工具入口改为上述五个命令；发布不激活。

## Impact

- 主要代码：`scripts/runtime-release/`、`scripts/deploy-runtime-blob-release.sh`、`scripts/deploy-all-with-runtime-blobs.sh`、`scripts/remote-deploy.sh`、`package.json`、`src/lib/runtime-release.ts`、`src/lib/runtime-release-store.ts`、`src/lib/runtime-release-streaming-publisher.ts`、`course-content/scripts/export_runtime.py`，以及对应合同测试。
- 消费端继续读取现有 `act-runtime-release.v2` manifest 与 `runtime/blobs/sha256/<sha256>`。不改 Teaching Projection、Authority overlay、developer-oss 网关。
- 进行中的 `simplify-runtime-app-compatibility-validation` 已去掉兼容性收据；本变更在其之上继续删除发布控制面，不恢复任何收据门禁。
- 知识侧 coordinated cutover 仍由 `scripts/knowledge-cutover/` 拥有；它只能调用新的 activate/rollback，不得再把 Runtime lifecycle 当状态机宿主。
