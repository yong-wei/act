## ADDED Requirements

### Requirement: Control workbench distinguishes gain-margin presentation states
控制工作台 SHALL 在频率响应可用时区分有限增益裕度、无穷增益裕度和不可用的分析数据，不得以同一缺失符号表示这三种状态。

#### Scenario: No finite phase crossover
- **WHEN** 控制分析结果包含有效的幅频和相频曲线，且相位交叉频率为空
- **THEN** 工作台 SHALL 显示 `GM ∞`
- **AND** SHALL 将相位交叉频率显示为“无相位交叉”或等价的明确文本

#### Scenario: Finite gain margin
- **WHEN** 控制分析结果包含有限的增益裕度和相位交叉频率
- **THEN** 工作台 SHALL 显示带 `dB` 单位的增益裕度和带 `rad/s` 单位的相位交叉频率

#### Scenario: Frequency response unavailable
- **WHEN** 控制分析结果没有可用的幅频或相频曲线
- **THEN** 工作台 SHALL 将增益裕度和相位交叉频率显示为不可用状态
- **AND** SHALL NOT 将其显示为无穷增益裕度

### Requirement: Stability-margin surfaces use consistent semantics
性能指标卡和频域图表的元信息 SHALL 对同一控制分析结果使用一致的增益裕度状态语义。

#### Scenario: Shared no-crossover state
- **WHEN** 同一分析结果没有有限相位交叉
- **THEN** 性能指标卡和 Bode、Nyquist 图表元信息 SHALL 一致地表达无穷增益裕度与无相位交叉
