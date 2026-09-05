## ADDED Requirements

### Requirement: 导出载体统一 composite 指标命名与解释

公平实验导出载体（Markdown 幻灯片、CSV、xlsx 工作簿与 JSON 派生说明）SHALL 把 composite 指标的人类可见名称统一显示为「结构与质量联合通过率」，注明其公式为结构通过且盲审质量非 major-error，SHALL NOT 使用泛化的「综合通过率」名称；内部 schema key `composite` 与冻结 official.json 数据 SHALL 保持不变。

#### Scenario: 普通基线 0% 附结构性来源解释

- **WHEN** 普通基线（未启用结构合同）的联合通过率为 0%
- **THEN** 幻灯片与派生说明 SHALL 在该指标旁说明「未启用结构合同；联合通过率 0% 不代表知识正确率 0%」

#### Scenario: 零分母引用指标显示 N/A

- **WHEN** 引用精确率或追溯覆盖率的分母为 0
- **THEN** 导出载体 SHALL 显示 N/A 而不是 0%

#### Scenario: 冻结数据兼容

- **WHEN** 导出派生运行
- **THEN** summary/official.json 真源 SHALL 保持字节不变
- **AND** delta 行的 metric 机器字符串 SHALL 保留 `composite@` 前缀，人类可见显示名 SHALL 统一为「结构与质量联合通过率」
