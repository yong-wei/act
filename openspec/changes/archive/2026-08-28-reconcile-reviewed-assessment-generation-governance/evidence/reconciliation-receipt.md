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
- 测试：`generated-candidate-governance.test.ts`（11 例，含新增重复发布与回执回读）、`generated-runtime-question-resolution.test.ts`（新增 2 例）、既有 catalog/route/persistence 测试；Assessment 域 32 文件 384 例通过。
- tasks：14/14 勾选。
- 校验：`openspec validate reconcile-reviewed-assessment-generation-governance --type change --strict` 通过；`git diff --check` 通过；`npm run typecheck` 零错误（exit 0）。
- 无第二套 candidate schema、状态机、catalog 或平行 publication receipt；历史题面、答案快照与 LearningFact 隐私边界未改写。

## 显式残余项（不阻断）

- 创建路由的 human/ai 来源由授权教师声明，服务端不独立核验；独立人工审核仍是批准门禁。
- retire/rollback 仅有域函数与测试，无 HTTP 运营入口。
- Assessment 全量 Map / persistence fallback 的最终删除由 `cutover-path-owned-assessment-attempts` 承担。
- `openspec validate --specs --strict` 存在与本 change 无关的既有失败 `student-micro-tutoring-eligibility-projection`。

本 receipt 仅含 hash、版本、身份与状态引用，不包含 prompt、模型响应原文、学生答案或本机绝对路径以外的敏感内容。
