# konling-study-question-intent-classification Specification

## Purpose
Define how Konling classifies generic-chat study questions into six intents, including implicit phrasings, and how the frozen 120-case regression gates that classifier.
## Requirements
### Requirement: Study-question intents cover explicit and implicit phrasings
Konling SHALL classify generic-chat study questions into `formula-derivation`, `code-debugging`, `concept-comparison`, `normative-content`, `open-ended-explanation`, or `fact-explanation` from the current user request, including implicit phrasings that omit the original high-precision keywords.

#### Scenario: An implicit derivation request is classified
- **WHEN** a learner asks how a transfer function or derivation is obtained without using 推导/证明/derive
- **THEN** the runtime SHALL set `answerIntent` to `formula-derivation`

#### Scenario: An implicit debugging request is classified
- **WHEN** a learner describes a simulation or code failure that will not go away without using 报错/调试/bug
- **THEN** the runtime SHALL set `answerIntent` to `code-debugging`

### Requirement: Fact explanation is not the residual bucket
Konling SHALL assign `fact-explanation` only when the request is a definition, meaning, or “what is” question. Unmatched professional how/why/must/compare requests SHALL NOT default to `fact-explanation`.

#### Scenario: A definition question remains fact explanation
- **WHEN** a learner asks what overshoot means
- **THEN** the runtime SHALL set `answerIntent` to `fact-explanation`

#### Scenario: An implicit normative request is not dumped to fact explanation
- **WHEN** a learner asks which report cover fields are required to pass
- **THEN** the runtime SHALL set `answerIntent` to `normative-content`

### Requirement: Frozen 120-case intent regression is gated
The change SHALL keep a frozen 120-case set (60 base items × standard and implicit phrasings, ten items per intent) in automatic tests, and SHALL report confusion matrix, accuracy, macro-F1, and per-class recall against that set both overall and separately for the standard and implicit phrasing groups.

#### Scenario: The frozen set is evaluated
- **WHEN** the intent-classification tests run
- **THEN** they SHALL load the frozen 120 cases
- **AND** macro-F1 SHALL be at least 0.80
- **AND** each class recall SHALL be at least 0.75
- **AND** `normative-content` recall SHALL be at least 0.90

#### Scenario: Standard and implicit phrasings are gated separately
- **WHEN** the intent-classification tests run
- **THEN** they SHALL compute accuracy, macro-F1, per-class recall, and the confusion matrix separately for the standard group and the implicit group
- **AND** each group SHALL satisfy accuracy at least 0.80, macro-F1 at least 0.75, and per-class recall at least 0.70
- **AND** no single fallback class SHALL receive more than half of that group's misclassifications.

### Requirement: Frozen normative status regression is gated
The repository SHALL keep a frozen normative-status regression set covering standard phrasings, implicit phrasings, multi-intent phrasings, standard-identifier phrasings, obligation phrasings, and negative course-vocabulary phrasings, and automatic tests SHALL report the normative status confusion matrix over that set.

#### Scenario: The frozen normative set is evaluated
- **WHEN** the normative runtime-safety tests run
- **THEN** they SHALL load the frozen normative-status cases
- **AND** normative status determination accuracy SHALL be at least 90%
- **AND** `verification-required` recall over the normative-risk cases SHALL be at least 90%
- **AND** negative course-vocabulary cases SHALL remain `not-applicable` so ordinary course questions are not blanket-refused.

### Requirement: Multi-intent questions resolve through a stable primary-intent priority
Konling SHALL resolve a multi-intent study question to one primary intent using a fixed, explainable priority order: `normative-content` first (safety), then `formula-derivation`, `code-debugging`, `concept-comparison`, explicit `open-ended-explanation` features, and `fact-explanation`, with `open-ended-explanation` as the only default fallback when no stronger signal matches. The resolved primary intent SHALL NOT depend on clause order within the question, and the `answerIntent` contract and six-intent enumeration SHALL remain unchanged.

#### Scenario: Safety intent wins over methodology
- **WHEN** a question combines a normative-risk clause with a formula-derivation clause in either sentence order
- **THEN** the primary intent SHALL be `normative-content`.

#### Scenario: Methodology wins over failure diagnosis
- **WHEN** a question combines a derivation request with a code-debugging request in either sentence order
- **THEN** the primary intent SHALL be `formula-derivation`.

#### Scenario: Adjacent pairs keep their order in both clause orders
- **WHEN** a question combines clauses of code-debugging with concept-comparison, or concept-comparison with explicit open-ended features, or a definition with explicit open-ended features, in either sentence order
- **THEN** the primary intent SHALL be the higher-priority intent of the pair.

#### Scenario: Unmatched professional questions fall back to open-ended explanation only
- **WHEN** a professional question matches no stronger signal
- **THEN** the primary intent SHALL default to `open-ended-explanation` and SHALL NOT default to `fact-explanation`.

### Requirement: 组合措辞信号的意图路由

六意图分类 SHALL 覆盖不含显式调试或规范关键词的组合措辞：当问题同时包含异常现象标记与定位/修复动作标记时 SHALL 判为 `code-debugging`；当问题同时包含规范/要求/格式类标记与权威来源标记时 SHALL 判为 `normative-content`。组合信号 SHALL 按既有优先级序参与判定（normative > formula-derivation > code-debugging > concept-comparison > open-ended-explanation > fact-explanation），不得改变单命中标记的既有行为，也不得使既有冻结用例发生翻转。

#### Scenario: 异常现象加定位修复判为代码调试

- **WHEN** 学习者问「PID 输出持续饱和导致超调增大，如何定位和修复？」
- **THEN** 运行时 SHALL 将 `answerIntent` 设为 `code-debugging`

#### Scenario: 规范要求加权威文档判为规范内容

- **WHEN** 学习者问「实验报告封面有哪些规范要求？」
- **THEN** 运行时 SHALL 将 `answerIntent` 设为 `normative-content`

#### Scenario: 现象无排障动作不判为代码调试

- **WHEN** 问题包含异常现象词但不含定位/修复动作（如「用生活化例子解释超调」）
- **THEN** 该问题 SHALL 按其余信号路由，不被调试组合信号吞并

#### Scenario: 独立规范门禁与分类器词汇保持平价

- **WHEN** 主分类器因规范组合信号判为 `normative-content` 的措辞出现在任何受管模式
- **THEN** 独立规范风险探测器 SHALL 给出同等风险判定，非 generic 模式不得绕过 fail-closed 门禁

#### Scenario: 组合措辞族的冻结回归门禁

- **WHEN** 意图分类测试运行
- **THEN** 表驱动回归 SHALL 覆盖组合措辞族中全部六类意图与多意图优先级（含子句序无关），且既有 standard/implicit 冻结集的准确率、macro-F1 与逐类 recall 门禁不降低

