## ADDED Requirements

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
