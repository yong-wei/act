## ADDED Requirements

### Requirement: V2 分层题库的意图混淆矩阵门禁

六意图分类 SHALL 在 `KONLING_FAIR_EXPERIMENT_BANK_V2` 十八道分层题（六意图 × 基础/综合/对抗）上满足总体意图一致率不低于 90%，规范内容与代码调试两类命中率均不低于 80%，其余意图命中率不低于 90%；回归 SHALL 按意图与难度报告混淆矩阵，且不得以硬编码完整题目文本的方式满足门槛。

#### Scenario: 实验安全规范判为规范内容

- **WHEN** 学习者问「使用旋转机械与功率电源开展控制实验时，上电前与运行中应遵循哪些安全规范？」
- **THEN** 运行时 SHALL 将 `answerIntent` 设为 `normative-content`

#### Scenario: 标准编号与来源引用判为规范内容

- **WHEN** 问题引用标准编号（如 GB/T 编号）或引用教材等权威出处并询问规范的当前结论（规范时效类）
- **THEN** 运行时 SHALL 将 `answerIntent` 设为 `normative-content`
- **AND** 独立规范风险探测器 SHALL 给出同等风险判定（#1901 平价保持）

#### Scenario: 代码片段加缺陷定位判为代码调试

- **WHEN** 问题包含代码围栏并要求找出缺陷、定位或修复（如标定/单位缺陷导致实测偏差）
- **THEN** 运行时 SHALL 将 `answerIntent` 设为 `code-debugging`
- **AND** 不含代码围栏且无排障动作的「缺陷」类概念问题 SHALL 不被该组合信号吞并

#### Scenario: 开放讲解兜底优先级不变

- **WHEN** 问题不含任何规范、推导、调试、比较或举例类专业信号
- **THEN** 运行时 SHALL 按既有兜底判为 `open-ended-explanation`，新增信号不得改变兜底的相对位置

#### Scenario: V2 分层回归按难度报告混淆矩阵

- **WHEN** 意图分类回归运行
- **THEN** 表驱动用例 SHALL 遍历 V2 题库全部十八道题，按意图与难度输出混淆矩阵
- **AND** 总体一致率、规范内容与代码调试命中率、其余意图命中率 SHALL 分别满足 90%/80%/80%/90% 门槛
