# Reconciliation receipt — reviewed-assessment-generation-governance

- 结果：`QUALIFIED`
- 合同身份：`adaptive-assessment-generation-review-publication`（canonical spec + archive `2026-08-21-govern-adaptive-assessment-generation-review-publication`）
- 关联 Issue：#1480（closed + status:archived，仅作状态列）；本 change Issue：#1564
- 冻结输入 revision：`7c0d39cee132355a269ccb292b75eba806790994`（本 change 分支基线）；既有合同实现提交 `4d57341d49a0c5181bb3df977ade8a2d536d0854`
- 对账矩阵：`evidence/reconciliation-matrix.md`
- 弃用台账：`evidence/deprecation-ledger.md`
- 覆盖台账：`evidence/candidate-catalog-coverage.md`

## 收口证据

- 代码：`generated-candidate-governance.ts`、`generated-candidate-persistence.ts`、`generated-candidate-catalog.ts`、`generated-catalog-runtime.ts`、`adaptive-assessment-item-catalog.ts`、`adaptive-assessment-catalog-selector.ts`（本 change 新增 `findGeneratedRuntimeQuestionById`）、`adaptive-engine.ts`、`adaptive-persistence.ts`、`adaptive-question-bank.ts`、generated-candidates 路由。
- 测试：`generated-candidate-governance.test.ts`（11 例，含新增重复发布与回执回读）、`generated-runtime-question-resolution.test.ts`（新增 4 例，含选择→解析→作答端到端与 torn fail-closed）、既有 catalog/route/persistence 测试；Assessment 域 33 文件 390 例通过。
- tasks：14/14 勾选。
- 校验：`openspec validate reconcile-reviewed-assessment-generation-governance --type change --strict` 通过；`git diff --check` 通过；`npm run typecheck` 零错误（exit 0）。
- PR #1664 复审整改（第一轮）：接受 Codex P1（已发布生成题被阶段策略家族级硬阻断），按本 change delta 的证据集对齐 `assessment-evidence-authority.ts`、`adaptive-assessment-semantic-review.ts` 与 `generated-candidate-catalog.ts`；terminal-validation 对 generated 家族的排除保持不变。
- PR #1664 复审整改（第二轮）：接受 Codex P1（torn hydration 回退静态 sidecar 导致旧发布物越权），`generated-catalog-runtime.ts` 在断裂 lineage 时安装空就绪 overlay 并禁止静态回退，lineage 恢复后自动重读。
- 无第二套 candidate schema、状态机、catalog 或平行 publication receipt；历史题面、答案快照与 LearningFact 隐私边界未改写。

## 显式残余项（不阻断）

- 创建路由的 human/ai 来源由授权教师声明，服务端不独立核验；独立人工审核仍是批准门禁。
- retire/rollback 仅有域函数与测试，无 HTTP 运营入口。
- Assessment 全量 Map / persistence fallback 的最终删除由 `cutover-path-owned-assessment-attempts` 承担。
- `openspec validate --specs --strict` 存在与本 change 无关的既有失败 `student-micro-tutoring-eligibility-projection`。
- 全量 `vitest run` 有 21 个既有失败（actkg/authority/知识图谱/commercial-ui 等域），stash 整改前后同样失败，与本 change 无关。

本 receipt 仅含 hash、版本、身份与状态引用，不包含 prompt、模型响应原文、学生答案或本机绝对路径以外的敏感内容。
