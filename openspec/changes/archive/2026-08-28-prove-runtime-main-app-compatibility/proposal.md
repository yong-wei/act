## Why

应用镜像发布与运行态内容发布已经具备独立的发布路径，却仍缺少一份由实际应用消费者生成的兼容性证据。结果是日常 Runtime Release 容易被错误地要求与应用 `main` SHA 相同，或在缺少可审计依据时切换运行态。

需要把两条版本线正式分离：应用始终从已冻结的 `main` 发布，Runtime 始终从已冻结的 `integration` 发布；两者通过不可变的实际消费兼容性证明连接，而不是通过 SHA 相等连接。

## What Changes

- 为 blob-backed Runtime Release 增加不可变的 `runtime-app-compatibility.v1` 证明，绑定候选 Runtime 清单身份、冻结 Runtime source revision、正在运行的应用镜像 digest 与其 `main` revision、消费者合同版本及数据库迁移身份。
- 在 Runtime 选择事务中重新核验该证明与当前应用身份、候选 manifest 及消费者合同；缺失、漂移或不兼容时保留现有 active/rollback Runtime，不写 selector。
- 固化发布边界：应用版本从 `origin/main` 冻结并具有独立发布版本；Runtime 版本从 `origin/integration` 冻结并具有独立 Release identity。二者可为不同提交，冻结后的任一分支变化均不参与当次发布。
- 将日常 Runtime 部署限制为当前应用镜像上的 Runtime mount、候选消费者校验与生命周期切换；不得构建、传输、替换或回退应用镜像，也不得运行应用数据库迁移、Nginx 或 systemd 配置。
- 将旧的“应用 revision 必须等于 Runtime integration revision”的首轮 cutover 入口标记为仅迁移兼容路径，阻止其被日常 `deploy:runtime` 选择。
- 修复已发现的应用部署封闭性：远端部署随同复制 provenance 依赖，并将已验证的镜像与知识部署模式写入 systemd unit，避免重启时退回默认镜像。

## Capabilities

### New Capabilities

- `runtime-main-app-compatibility-proof`: 证明并验证独立 Runtime Release 与正在运行的 main 应用镜像之间的实际消费者兼容性。

### Modified Capabilities

- `content-addressed-runtime-release-storage`: 将应用消费者兼容性证明纳入 blob Runtime 的 candidate selection 和 active receipt。
- `oss-runtime-release-management`: 明确日常 Runtime 操作的独立版本线、兼容性门禁与首轮迁移入口边界。

## Impact

- `scripts/runtime-release/` 的 v2 发布、候选校验、生命周期和 receipt 读写。
- `scripts/deploy-runtime-blob-release.sh`、远端 Runtime activator 与相应契约测试。
- `deploy/podman/configure-service.sh`、`scripts/remote-deploy.sh` 及部署防回退测试。
- 生产 ECS Runtime lifecycle records 和应用镜像部署回执；不改变课程、用户或题目数据模型。
