## Why

`generic-chat` 的六类学习问答意图由关键词启发式分类，未命中时一律回退为 `fact-explanation`。显式问法可以分对，隐式问法则大量塌缩到事实解释，导致讲解结构、规范性门槛和引用策略选错。

## What Changes

- 修正六类意图的判定顺序、隐式问法规则和默认回退，使 `fact-explanation` 只承接定义/是什么类问题，不再作为残差桶。
- 冻结 60 道基础题 × 标准/隐式两种问法共 120 个回归用例，并在自动测试中报告混淆矩阵、准确率、宏平均 F1 与逐类召回率。
- 保持既有 `answerIntent` 联合类型、调用方合同和 `generic-chat` 公共入口不变。

## Capabilities

### New Capabilities

- `konling-study-question-intent-classification`: 定义六类学习问答意图的分类不变量、隐式问法覆盖、残差回退边界，以及 120 用例回归门禁。

### Modified Capabilities

None. `konling-agent-runtime` 的既有 `answerIntent` 合同保持不变；分类不变量放在新 capability 中。

## Impact

- `src/lib/konling-agent-runtime.ts` 的 `classifyGenericStudyQuestionIntent` 与 `buildKonlingTeachingAssistantRuntimeContract`。
- 新增 120 用例夹具与分类度量测试。
- 不改模型供应商、检索服务、数据表或 #1818 的规范内容 fail-closed 安全门禁。
