## 1. 绑定解析器

- [x] 1.1 实现 ResourceNode → B′′ resourceId 确定性反解（复用 `src/lib/teaching-projection/identity.ts` 派生规则，与 `path-planning-consumes-teaching-projection` 共用同一映射函数）
- [x] 1.2 实现 sourcePath → 对象键解析：`content:<sha256>` → blob 内容键；`authoring:` 课次媒体 → release 资产路径映射表（无条目跳过并按族计数）；`null` → 按资源类型走既有规则，仍无身份记 `no-runtime-identity`
- [x] 1.3 活动 runtime release manifest 连接：键不在 manifest 记 `not-in-active-release`；无活动 release 记 `no-active-release`；绑定记录携带 B′′ 投影标识与 release 标识

## 2. 装配与候选池

- [x] 2.1 候选节点在装配/定稿时携带 runtime 绑定字段并随批次持久化；导航 target 与 destination contract 不变
- [x] 2.2 `buildResourceCandidatePoolDiagnostics` 按资源族追加 runtime-bindable 计数（连接活动 release 后的可用数）

## 3. 读取验证改造

- [x] 3.1 `verifyCandidateObjectKeyReadRecords` 改为消费节点绑定字段；`resolveAdaptivePathRuntimeObjectKey` 的 target 字符串反解退役
- [x] 3.2 绑定失败逐节点记录状态与原因并随批次持久化；批次内无可用绑定时标记 `limited` 并说明原因，禁止静默空记录
- [x] 3.3 既有夹具测试迁移到绑定构造；故障注入覆盖 `no-active-release` / `not-in-active-release` / `no-runtime-identity`

## 4. 呈现

- [x] 4.1 候选比较投影呈现逐节点绑定状态、runtime 来源、读取状态与失败原因；学生 API 维持原始对象键不下发

## 5. 验证

- [x] 5.1 绑定解析、降级、故障注入聚焦测试
- [x] 5.2 端到端：物化本地 release 下以 control-correction 目标生成候选，断言 OSS 资源数非零且记录含 releaseId/对象键/校验状态
- [x] 5.3 现有路径测试全量回归不回退；`rtk npm run typecheck` 通过
- [x] 5.4 `rtk openspec validate bind-path-candidates-runtime-assets --type change --strict` 通过
