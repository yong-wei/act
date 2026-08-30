## Context

Developer OSS runtime 已能固定生产 active v2 Release，并以共享只读 Blob 挂载和 checkout 独立逻辑视图启动 Lima 服务。本次复现中，逻辑路径仍存在，但相对链接指向的 `.act-runtime-blobs` 文件对应用用户返回 `EACCES`；同一视图还缺少 v2 微辅导资源投影。现有启动与 readyz 只证明选择和服务存活，没有从消费者身份证明完整文件集可读。

本地临时恢复已证明业务数据和微辅导资格逻辑正确：在同一 Git 修订的原生干净工作树读取完整治理工件后，截图题目 B 选项由 `RESOURCE_UNAVAILABLE` 变为 `qualified: true`。永久修复应落在 runtime 交付边界，而不是放宽微辅导 fail-closed 规则。

## Goals / Non-Goals

**Goals:**

- 在任何消费者启动前，以实际应用 UID/GID 验证完整 manifest 逻辑树和所需治理工件可读。
- 把挂载、Blob、逻辑链接、权限和工件缺失区分为可诊断的 runtime 失败。
- 提供 checkout 限域、可恢复且不触碰 OSS 不可变对象的重建流程。
- 让 readyz 反映 pinned Release 的持续文件系统可用性。

**Non-Goals:**

- 不修改微辅导资源投影、题目归因、验证题物化或编排器降级语义。
- 不改变生产 active Release、OSS 发布格式、选择器或 RAM 权限范围。
- 不以复制完整 runtime 到每个工作树作为长期方案。

## Decisions

### 1. 以消费者身份执行 manifest 全量叶节点验证

物化器完成 attach 后、select 和启动前，验证器遍历 manifest 的规范逻辑路径；对每个叶节点执行 `lstat`、相对链接解析、Blob 根 containment、普通文件打开、大小和 SHA-256 校验。验证进程必须使用与 frontend/worker 相同的 Linux 用户，避免 root 或 mount owner 检查通过而应用读取失败。

未采用“只检查代表性文件”，因为本次故障同时包含权限失败和单个 v2 工件缺失，抽样无法证明应用所需视图完整。

### 2. capability smoke 建立在 manifest 验证之上

完整 manifest 验证证明发布声明与视图一致；capability smoke 再证明当前应用启用的关键治理集合可被加载并满足内部身份关系。微辅导 smoke 至少读取 v2 assessment baseline、option attributions、resource projection 和 validation registry，并验证它们声明的版本与相互引用。

未把 capability 文件硬编码为物化器的全局固定列表；应由仓库维护的、版本化 runtime requirement registry 提供，避免不相关能力阻塞最小运行配置。

### 3. readyz 绑定固定 Release 与最近一次消费者读取证明

bootstrap 写出不含凭据的验证回执，记录 Release ID、manifest/tree digest、验证器版本、consumer UID/GID、叶节点计数、required artifact set digest 和完成时间。readyz 只接受与当前 bind 和运行进程匹配的回执，并对小型关键文件执行有界持续探测；失败时 `runtime.ready=false`，保留身份和错误类别。

未在每次 readyz 请求中重新哈希全部 runtime，以避免大目录和媒体带来的高延迟。

### 4. 修复通过 checkout-owned transaction 重建

修复命令先停止目标 checkout 消费者，在机器锁下验证 bind、lease、shared mount 和 pinned Release，卸载目标 bind，重新 prepare/attach/verify/select，最后重启。共享 Blob mount 仅在无其他 live lease 且身份明确时处理。任何不确定状态均停止并保留现场。

临时使用原生 Git 工作树启动仅作为已验证的本地绕行，不成为正式回退路径；永久实现不得掩盖 OSS runtime 故障。

## Risks / Trade-offs

- [首次全量验证会增加启动时间] → 以 manifest digest、mount identity 和 consumer identity 绑定验证回执；完全一致时复用，但仍执行有界关键文件探测。
- [按需 ossfs 读取导致首次哈希下载较多 Blob] → 允许分层验证：非媒体叶节点启动前全量字节校验，大媒体使用 manifest size、可读打开和既有发布哈希证明；具体阈值必须由测试固定。
- [错误修复可能影响其他工作树] → 所有卸载和清理必须由 checkout receipt、bind identity 和 lease 共同证明，无法证明即停止。
- [readyz 探测造成瞬时 OSS 波动误报] → 区分持续验证失败与一次性读取错误，但在无法读取 required artifact 时保持 fail-closed。

## Migration Plan

1. 为 manifest 视图、消费者权限和 required artifact registry 增加纯验证器及失败分类测试。
2. 将验证器接入 Lima/Linux/WSL2 bootstrap 的 select 前门禁，并补充回执。
3. 扩展 readyz runtime 投影和启动/停止/repair 集成测试。
4. 在 Lima 上复现旧视图失败，确认新门禁拒绝启动；重建后运行 54 道 practice 微辅导覆盖 smoke。
5. 保留当前 pinned Release；若新流程失败，回滚代码并维持服务停止或使用用户明确选择的本地开发运行模式，不改写 OSS 状态。

