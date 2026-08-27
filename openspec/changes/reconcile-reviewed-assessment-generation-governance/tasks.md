## 1. Characterization and dependency gate

- [ ] 1.1 验证 `establish-modular-monolith-refactor-charter` 与 `enforce-modular-domain-dependency-contracts` 已 qualified、strict-valid，并冻结本 change 与既有 #1480 合同的 source revision。
- [ ] 1.2 对账 `govern-adaptive-assessment-generation-review-publication` 的 proposal/design/spec/tasks、canonical catalog spec、本地代码、测试、archive 路径和 GitHub #1480 状态；输出缺口而不把 closed 视为完成。
- [ ] 1.3 为 `adaptive-engine.ts` 的 `globalThis.__adaptiveAssessmentStore.generatedQuestions`、模板生成器、`ai_generated` 字段和 catalog 选择器增加 characterization，区分临时 practice、候选和发布题。

## 2. Reconcile the single generation-governance contract

- [ ] 2.1 复用既有 candidate/review/catalog 类型与 identity，确认没有第二套 candidate schema、状态机、exporter 或平行 publication receipt；缺失项登记到同一合同的实现计划。
- [ ] 2.2 在生成边界实现 truthful generation kind，修正模板误标并让模板内存对象显式 practice-only；客户端、Map 或模型建议不得授予候选、目录或 mastery 权限。
- [ ] 2.3 补齐或证明 candidate → deterministic precheck → 独立人工审核 → versioned catalog publication 的完整 lineage、stale、退役和回滚行为。
- [ ] 2.4 确认 `AdaptiveAssessmentItemRef` 与既有答案快照引用当前 catalog identity，且生成治理不改写历史题面、答案或 LearningFact 隐私边界。

## 3. Targeted and domain verification

- [ ] 3.1 增加模板/模型/人工来源 discriminator、Map-only blocked、重启与缺失 lineage、自动预检不可批准、独立审核、stale、重复发布和 publication receipt 回读测试。
- [ ] 3.2 运行生成治理与 adaptive-assessment-item-catalog 针对测试，并验证 readiness、checkpoint、remediation、terminal-validation 和 provisional evidence 资格不被放宽。
- [ ] 3.3 运行 Assessment 域测试、相关数据治理/隐私测试、`rtk npm run typecheck`；预先存在的失败单列，不以其掩盖新回归。

## 4. Deletion, ledger and closeout evidence

- [ ] 4.1 删除本 change 引入的 `ai_generated` 模板映射和无调用生成入口；将 Assessment 全量 Map/fallback 删除条件交给 `cutover-path-owned-assessment-attempts`，不得留下新的 facade。
- [ ] 4.2 更新 deprecation ledger、reconciliation matrix 和 candidate/catalog coverage 台账，记录每个旧入口、消费者、替代边界、删除条件和验证证据。
- [ ] 4.3 只有代码、测试、tasks、archive 和 Issue 对同一合同身份一致时才生成 `QUALIFIED` receipt；否则保持 `NOT_QUALIFIED` 并写明 blocker。
- [ ] 4.4 运行 `rtk openspec validate reconcile-reviewed-assessment-generation-governance --type change --strict` 与 `git diff --check`；不执行 Issue、提交、推送、部署或生产激活。
