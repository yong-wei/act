## ADDED Requirements

### Requirement: v2 投影必须物化到可编排的 TeachingResource

系统 SHALL 将 `micro-tutoring-resource-projection-v2.json` 中每条启用且学生可见的资源幂等物化到 `TeachingResource`。物化记录 MUST 具有唯一 `registryId`、`teacherOnly=false`，以及运行时认可的 `config.remediation`：`prerequisiteKnowledgeNodeIds` 包含该条目的规范 `knowledgeNodeId`，`misconceptionTags` 包含该条目的受控错因。Git 捕获修订、投影 `resourceRevision` 与 registry 身份 MUST 写在同一条记录上。v1 投影文件 MUST 保持只读。编排器查询与 fail-closed 条件 MUST 保持不变。

#### Scenario: 缺失的投影资源被创建

- **WHEN** 当前数据库没有某条 v2 投影 `registryId` 的 TeachingResource
- **AND** 该 `registryId` 在资源注册表中存在且学生可见
- **THEN** 同步 SHALL 创建 `id` 与 `registryId` 相同的记录
- **AND** 写入包含规范节点与错因的 `config.remediation`
- **AND** 绑定当前干净 Git 捕获修订

#### Scenario: 已有记录补齐编排绑定

- **WHEN** 已有 TeachingResource 的 `registryId` 匹配投影
- **AND** `knowledgeNodes` 为空且 `config.remediation` 缺少规范节点
- **THEN** 同步 SHALL 合并 `prerequisiteKnowledgeNodeIds` 与 `misconceptionTags`
- **AND** 不得覆盖无关 config 键
- **AND** 不得修改该行主键

#### Scenario: 编排器能解析复现错因

- **WHEN** 物化后的数据库路径收到规范节点 `kn:autocontrol:simulation-validation` 与错因 `misconception:simulation-validation-practice:reruns-without-discrepancy-record`
- **THEN** 编排器 SHALL 选择 `registryId=lesson11-graphical-thinking-workshop` 的学生可见资源
- **AND** 不得返回 `RESOURCE_UNAVAILABLE`

#### Scenario: 9 组投影资源均能通过数据库路径

- **WHEN** 对当前 v2 投影的全部 9 个 `registryId` 执行同步后查询
- **THEN** 每组资源都能被现有编排查询找到
- **AND** 各自规范知识节点精确匹配 `config.remediation.prerequisiteKnowledgeNodeIds`

#### Scenario: 带权威行的覆盖审计资源缺口归零

- **WHEN** 覆盖审计消费 v2 投影并使用同步后的 TeachingResource 作为权威行
- **THEN** 135 道题、272 个错误选项的 `RESOURCE_UNAVAILABLE` 计数 MUST 为 0
- **AND** 不得把该结果当成 parent 系列的生产资格回执

#### Scenario: 缺失、撤销或身份漂移时 fail-closed

- **WHEN** registry 未知、同一 `registryId` 多行、`teacherOnly=true`、工作区不洁净，或投影 revision 与写入记录不一致
- **THEN** 同步或编排 SHALL 返回稳定失败原因
- **AND** 不得放宽查询、硬编码资源路径或回退到邻近资源

#### Scenario: 同步幂等

- **WHEN** 对同一干净捕获修订连续执行两次同步
- **THEN** 第二次 MUST 不改变已对齐记录的身份与 remediation 绑定
- **AND** 不得重复创建 TeachingResource
