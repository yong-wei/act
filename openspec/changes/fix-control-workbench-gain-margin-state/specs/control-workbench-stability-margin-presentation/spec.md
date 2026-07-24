## ADDED Requirements

### Requirement: Control workbench distinguishes gain-margin presentation states
控制工作台 SHALL 区分有限相位交叉、当前频率范围内未观测到相位交叉和不可用的分析数据，不得将采样范围内未观测到的交叉表述为无穷增益裕度。

#### Scenario: Phase crossover not observed in the requested range
- **WHEN** 控制分析内核返回 `phaseCrossoverStatus = notObservedInFrequencyRange`
- **THEN** 工作台 SHALL 显示增益裕度不可用
- **AND** SHALL 将相位交叉频率显示为“未在当前频率范围内观测到”或等价的明确文本

#### Scenario: Finite gain margin
- **WHEN** 控制分析结果包含有限的增益裕度和相位交叉频率
- **THEN** 工作台 SHALL 显示带 `dB` 单位的增益裕度和带 `rad/s` 单位的相位交叉频率

#### Scenario: Frequency response unavailable
- **WHEN** 控制分析结果没有可用的幅频或相频曲线
- **THEN** 工作台 SHALL 将增益裕度和相位交叉频率显示为不可用状态
- **AND** SHALL NOT 将其显示为无穷增益裕度

### Requirement: Stability-margin surfaces use consistent semantics
性能指标卡和频域图表的元信息 SHALL 对同一控制分析结果使用一致的相位交叉状态语义。

#### Scenario: Shared unobserved-crossover state
- **WHEN** 同一分析结果没有在请求频率范围内观测到相位交叉
- **THEN** 性能指标卡和 Bode、Nyquist 图表元信息 SHALL 一致地表达该范围限制
