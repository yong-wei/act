# Reconciliation matrix — reviewed assessment generation governance

Frozen inputs（本 change 实施前冻结）：

- 本 change 分支基线 HEAD：`7c0d39cee132355a269ccb292b75eba806790994`（branch `reconcile-reviewed-assessment-generation-governance`）。
- 既有合同实现提交：`4d57341d49a0c5181bb3df977ade8a2d536d0854`（2026-08-21，`feat(assessment): govern generated question review and publication`）。
- 前置 change（均已归档并通过 spec strict validation）：`establish-modular-monolith-refactor-charter`、`enforce-modular-domain-dependency-contracts`（archive 前缀 `2026-08-26-`）。
- Canonical spec：`openspec/specs/adaptive-assessment-generation-review-publication/spec.md`、`openspec/specs/adaptive-assessment-item-catalog/spec.md`。
- GitHub Issue #1480：CLOSED（2026-08-21T12:19:19Z），labels 含 `status:archived`。Issue closed 仅作为一列状态，不作为完成证明。

## 一致性矩阵

| 列 | 证据 | 状态 |
| --- | --- | --- |
| 合同身份 | `adaptive-assessment-generation-review-publication` canonical spec（archive 沉淀） | 一致 |
| 归档路径 | `openspec/changes/archive/2026-08-21-govern-adaptive-assessment-generation-review-publication/`（tasks 12/12 勾选） | 一致 |
| 持久化模型 | `prisma/schema.prisma` 五表 + 迁移 `20260821120000_add_generated_assessment_candidate_governance` | 一致 |
| 候选流水线实现 | `src/features/adaptive-assessment/generated-candidate-governance.ts`、`generated-candidate-persistence.ts` | 一致 |
| 目录发布实现 | `adaptive-assessment-item-catalog.ts`（`buildGeneratedItems`/`trustedGeneratedReceipt`）、`generated-candidate-catalog.ts`、`generated-catalog-runtime.ts` | 一致 |
| HTTP 入口 | `src/app/api/assessment/generated-candidates/`（create/review/publish） | 一致 |
| 针对测试 | `generated-candidate-governance.test.ts`、`generated-candidates-route.test.ts`、`generate-question-route.test.ts`、`adaptive-assessment-item-catalog.test.ts` 等 | 一致（见 coverage ledger） |
| Issue 状态 | #1480 closed + status:archived | 与代码证据同时成立，不单独采信 |

## 对账发现的缺口与处置

| 缺口 | 证据 | 处置 |
| --- | --- | --- |
| 已发布 generated catalog 项无法解析为运行时题目，path-owned 选择命中时会在 `adaptive-engine.ts` 抛“缺少运行时题目实现” | 修复前 `getAdaptiveQuestionById` 仅查 preset、checkpoint-authored 与会话 Map | 本 change 补齐：`findGeneratedRuntimeQuestionById`（catalog-selector）+ `getAdaptiveQuestionById` 回退；测试 `generated-runtime-question-resolution.test.ts` |
| 阶段策略对已发布生成题家族级硬阻断（PR #1664 Codex P1） | 修复前 `assessment-evidence-authority.ts` 对所有 `generated-adaptive-question` 无条件加 `generated-item-limited-to-practice`，且 generated 审核决定因缺 kaq/misconception/remediation 绑定与 version refs 漂移永远无法 authoritative | 按本 change delta 的证据集对齐：`generated-item-limited-to-practice` 仅在缺 publication receipt 时命中；generated 家族豁免 bank 本体专属的 kaq/misconception/remediation 缺失检查（其证据由预检 + 逐项人工审核 + receipt 承担）；`generatedReviewDecisionsFromStore` 的 `metadataVersionRefs` 补齐四个 generated 版本引用消除先天 stale；terminal-validation 对 generated 家族的排除保持不变；端到端测试覆盖 选择 → 运行时解析 → 作答 |
| 已发布生成题缺 rubric 被 `missing-scoring-rubric` 阻断 | `assessment-evidence-authority.ts` | generated 家族豁免：预检强制恰好一个正确答案且人工逐项接受 answer，rubric 是 bank 家族主观题要求 |
| 答案持久化把已发布生成题 id（`generated-revision:` 前缀）归类为 `preset` | `adaptive-persistence.ts` `questionSource` | 本 change 归类为 `generated-reviewed`；catalog 快照分支此前已正确，本修复仅影响 hash 输入的真实性 |
| 创建路由的 human/ai 来源由授权教师在请求体声明，服务端无法独立核验 | `generated-candidates/route.ts` | 残余风险：独立人工审核是批准门禁；记录在案，不阻断 |
| retire/rollback 只有域函数与测试，无 HTTP 入口 | `generated-candidate-governance.ts:486-500` | 合同未要求 HTTP 面；记录为后续运营入口缺口，不阻断 |
| spec strict validation 既有失败 `student-micro-tutoring-eligibility-projection` | `openspec validate --specs --strict` | 与本 change 无关的既有债务，单列 |

结论：除上表所列已修复缺口与显式残余项外，代码、测试、tasks、archive 与 Issue 指向同一份合同身份；不存在第二套 candidate schema、状态机、目录或平行发布回执。
