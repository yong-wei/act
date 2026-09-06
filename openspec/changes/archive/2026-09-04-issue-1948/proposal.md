## Why

2026-09-04 三臂公平实验（fair-live-20260904-r1，基线 `origin/integration@72ffb28c2`）中，完整功能组总体意图一致率仅 `8/12 = 66.7%`：`code-debugging` 与 `normative-content` 两类意图各 `0/2` 命中，两条样本全部被路由为 `open-ended-explanation`。

调查结论（2026-09-04，act-dev2）：

- **根因是通用意图分类器缺少第三措辞族。** `classifyGenericStudyQuestionIntent`（`src/lib/konling-agent-runtime.ts`）的关键词族只覆盖「报错/调试/bug」与「国家标准/规范格式/必须写/才算合格」两类显式措辞。公平实验样本「PID 输出持续饱和导致超调增大，如何定位和修复？」没有任何单命中调试标记，「实验报告封面有哪些规范要求？」没有命中任何规范标记（marker 是 `规范书写`/`规范格式` 的完整子串，不匹配「规范要求」），两者按序落入 catch-all `open-ended-explanation`。
- **规范类回落会绕过安全门禁。** `buildKonlingStudyQuestionContract` 中 `requiresNormativeGate = answerIntent === 'normative-content' || independentRisk`；错误回落使 `normativeGuidance` 变为 `not-applicable`，绕过应有的来源核验与不确定性表达，下游结构合同与引用要求也选错。
- **既有冻结回归集没有暴露此缺口。** 120 例意图集与 58 例规范状态集只含 standard/implicit 两个措辞族，公平实验样本属于未覆盖的「现象＋定位修复」「规范要求＋权威文档」组合措辞族。
- **公平实验摘要只输出总体一致率。** `classificationAgreement` 是单一 `rateMetric`，类别级失败会被总体准确率掩盖。

组合信号方案已在本地对全部冻结集全量模拟：120 例意图集 0 翻转（两组 accuracy 保持 1.000）、58 例规范状态集 0 翻转（overall/recall 保持 1.000、负例 0 误报）、多意图优先级表 0 回归，且两条失败样本及 8 个邻域变体全部正确路由。

## What Changes

- `classifyGenericStudyQuestionIntent` 增加两个组合信号，均按既有优先级序插入对应分支：
  - `code-debugging`：异常现象标记（饱和/超调/振荡/发散/不收敛/抖动/失稳/畸变/溢出/崩溃/卡死）AND 定位/修复标记（定位/修复/排查/排除/解决/怎么办/怎么处理/如何处理/找出原因等），与既有单命中标记并列；
  - `normative-content`：规范/要求/格式/封面/模板/书写/排版 AND 权威来源标记（报告/论文/学校/教务/学院/课程/考核/大纲/官方/标准），与既有 `KONLING_NORMATIVE_QUERY_MARKERS` 单命中并列。
- 独立规范风险探测器 `hasIndependentNormativeRisk` 同步获得同一规范组合信号，维持「独立门禁不弱于主分类器」的 #1901 平价不变量。
- 意图路由回归测试增加表驱动的组合措辞族用例（覆盖六类意图与两条公平实验原始样本），并扩展多意图优先级表（规范组合 > 调试组合、公式 > 调试组合的子句序无关用例）。
- 公平实验 `classificationAgreement` 摘要增加逐意图混淆分解（每题库意图的 routed 分布与一致率），使类别级失败在官方摘要中可见。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `konling-study-question-intent-classification`: 六意图分类需覆盖「异常现象＋定位/修复」与「规范/要求/格式＋权威来源」组合措辞；冻结回归门禁需覆盖组合措辞族；多意图优先级对组合信号子句保持序无关。
- `konling-fair-baseline-replay-evaluation`: 官方摘要的分类一致率必须输出逐意图混淆分解，不得只报总体率。

## Impact

- `src/lib/konling-agent-runtime.ts`：`classifyGenericStudyQuestionIntent`、`KONLING_NORMATIVE_QUERY_MARKERS` 邻域（新增共享组合信号常量与谓词）、`hasIndependentNormativeRisk`。
- `src/lib/__tests__/konling-implicit-intent-routing-1903.test.ts`：组合措辞族表驱动用例与多意图优先级表扩展。
- `src/lib/__tests__/konling-normative-runtime-safety-1901.test.ts`：规范组合信号的独立门禁平价断言（如需新增冻结用例则同步 `src/lib/konling-normative-status-cases.json`）。
- `src/lib/konling-fair-experiment/types.ts`、`aggregate.ts`：`classificationAgreement` 逐意图混淆分解。
- `src/lib/__tests__/konling-fair-experiment-1900.test.ts`：摘要逐意图混淆输出断言。
- 显式非目标（与 Issue 一致）：不通过硬编码完整题目文本获得通过；不改回答章节标题或引用评分口径；不改变六意图枚举、优先级序与 catch-all 语义；不新增 LLM 意图分类调用。
