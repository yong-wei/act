## ADDED Requirements

### Requirement: 严格审计输出可绑定的内容身份

严格覆盖报告 SHALL 为规范化输入集合和规范化报告内容提供稳定摘要，并记录 Git capture revision 与数据库 projection capture revision，使生产资格回执能够精确引用一次审计。报告不得包含题干、选项、答案、用户标识、本机绝对路径或可逆错误选项引用。

#### Scenario: 资格回执引用严格报告

- **WHEN** 严格报告在干净、同修订输入上生成
- **THEN** 报告 SHALL 提供稳定内容摘要和安全计数
- **AND** 生产资格回执 SHALL 能够回读并验证该精确摘要

#### Scenario: 报告输入在资格生成前漂移

- **WHEN** 任一目录、审核、映射、资源、验证投影或数据库修订在报告后变化
- **THEN** 原报告 SHALL 不再满足当前资格输入
- **AND** 系统 SHALL 要求重新审计而不是复用旧摘要
