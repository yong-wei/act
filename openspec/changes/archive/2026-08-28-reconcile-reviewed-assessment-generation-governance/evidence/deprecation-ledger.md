# Deprecation ledger — assessment generation governance

| 旧入口/行为 | 消费者 | 替代边界 | 删除条件 | 验证证据 |
| --- | --- | --- | --- | --- |
| 模板生成题误标 `ai_generated` | 旧 generate-question 响应、`generatedMetadata` | truthful `generationKind: 'template'` + `source: 'template-generated'`（`adaptive-question-bank.ts`、`generate-question/route.ts`） | 已由 `4d57341d4` 删除；本 change 复核 assessment 域无残留 | grep `ai_generated` 在 assessment 域零命中；`generate-question-route.test.ts` 断言 `source !== 'ai_generated'` |
| 进程内 `generatedQuestions` Map 作为“候选/目录证据” | `getAdaptiveQuestionById`、`allQuestions` | Map 仅承载 owner/session 限域的临时 practice；catalog 只接受带 publication receipt 的候选 | Assessment 全量 Map 删除由 `cutover-path-owned-assessment-attempts` 执行，本 change 不新建 facade | `generated-candidate-governance.test.ts`“无回执保持 provisional”；`buildGeneratedItems` 无回执时 `missing-generated-publication-receipt` |
| 已发布生成题运行时不可解析（对账新发现） | path-owned catalog 选择分支 | `findGeneratedRuntimeQuestionById` 从同一 catalog 快照重建运行时题目；`getAdaptiveQuestionById` 回退 | 随本 change 修复；Map 最终删除仍归下游 change | `generated-runtime-question-resolution.test.ts` 2 例 |
| 已发布生成题 id 被归类为 `preset` | `adaptive-persistence.ts` `questionSource` | `generated-revision:` 前缀归类 `generated-reviewed` | 随本 change 修复；历史答案不受影响（此前该路径不可达） | 域测试 384 例通过 |
| `*WithPersistenceFallback` / `isAdaptiveAssessmentPersistenceEnabled` | adaptive-persistence 调用方 | DB 优先 + fallback | 不在本 change 范围；删除条件由 `cutover-path-owned-assessment-attempts` 定义 | 本 change 未改动其行为 |

说明：本 change 自身未引入任何 `ai_generated` 模板映射或新的生成入口，因此 4.1 的删除动作落实为“复核既有误标已删除 + 修复对账新发现的真实性缺口”，无新增 facade。
