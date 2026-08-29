## Why

Assessment、learner state、课程插件、path planner 和 recommendation/intervention 迁移后，旧的 `adaptive-learning` forwarding、`src/lib/adaptive-*` authority、fallback flags/shims 以及 `src/features/adaptive-learning/kaq-quiz-coverage.ts` re-export 仍可能被生产导入。它们会保留第二套行为，并使“已迁移”无法由导入图和运行时证据证明。

## What Changes

- 建立以当前 HEAD 为准的 adaptive entrypoint inventory 和 production import-graph gate；只有前置五项 change 严格验证且所有调用者迁移后才允许删除。
- 删除 `src/features/adaptive-learning` 中可证明为 forwarding 的 `kaq-quiz-coverage.ts`、旧 `src/lib/adaptive-*` 权威实现、fallback helpers、retired feature flags、shims 和 re-exports；不以 facade 维持旧入口。
- 旧 `EvidenceOutbox` consumer 只有在新的 `EvidenceOutbox → worker → LearningFact` 协议完成 qualification 且旧 consumer 零生产调用后才可删除；不得提前切断跨进程证据投影。
- 保留仍由其他领域使用的旧 Prisma 表、历史事实和明确登记的非 adaptive adapters；保留不等于保留旧 Assessment/Personalization authority。
- 更新 owner/deprecation ledger、架构规则和 negative tests，证明生产导入为零、无第二 planner/recommendation/mastery/attempt authority；不部署、不激活生产 selector。

## Capabilities

### New Capabilities

- `adaptive-entrypoint-retirement`: 定义迁移后旧 adaptive 入口、flag、shim、forwarding 和 re-export 的删除门禁与证据。

### Modified Capabilities

- `adaptive-learning-governance-contracts`: 将 entrypoint retirement、生产导入图和未完成前置 change 纳入治理合同。

## Dependencies

- 前置并必须逐项 qualified：`reconcile-reviewed-assessment-generation-governance`、`cutover-path-owned-assessment-attempts`、`reduce-personalization-learner-state`、`externalize-control-correction-personalization-plugin`、`cutover-personalization-path-planner`、`migrate-personalization-recommendations-and-interventions`；其中 recommendation/intervention 的 EvidenceOutbox 协议必须单独有完整证据。
- 依赖已 qualified 的 `establish-modular-monolith-refactor-charter` 与 `enforce-modular-domain-dependency-contracts`；按 owner ledger 判断旧 Prisma 表和跨领域 adapter 是否保留。
- 本 change 是代码入口清理，不授权部署、数据删除、生产激活或重新解释 GitHub Issue 状态。

## Impact

- 影响 `src/features/adaptive-learning/`、`src/lib/adaptive-*`、Assessment/Personalization 旧 fallback 和 flag references、架构测试、deprecation/owner ledger 及所有残余调用者。
- 需要当前 SHA 的导入图、EvidenceOutbox consumer 零调用证明、构建/测试生产入口扫描、负向架构测试和受影响域验证；历史数据不重写，仍有 owner 的 Prisma 表不删除。
