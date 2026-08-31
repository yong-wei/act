# micro-tutoring-resource-registry Specification

## Purpose
定义从 TeachingResource 与资源注册表派生的微辅导资源治理投影：按 `kn:` 节点和受控错因复用已审核资源，绑定 registry 身份、revision、学生可见启动地址和学习动作。本投影不是第二套资源正文权威，也不表示 54/54 运行时已完成。
## Requirements
### Requirement: 微辅导资源投影复用现有资源 authority

系统 SHALL 从现有 TeachingResource、资源注册表和 active 规范知识节点派生版本化微辅导资源投影。每条记录 MUST 包含 TeachingResource/registry 稳定身份、资源 revision 或内容哈希、`kn:` 节点、适用受控错因、学生可见性、先修关系、预计时长、学习动作、启动地址、投影版本和捕获修订；投影不得复制资源正文或以组件路径建立新 authority。

#### Scenario: 现有资源成为微辅导候选

- **WHEN** 一个已登记资源通过节点、错因、隐私、版本和可达性审核
- **THEN** 投影 SHALL 引用其稳定 TeachingResource 与 `registryId` 身份
- **AND** 同一资源 MAY 通过分别审核的关系服务多个来源题

#### Scenario: 手写目录与资源 authority 冲突

- **WHEN** 微辅导投影引用的资源 revision、registry 身份或学生可见性与当前 authority 不一致
- **THEN** 该记录 SHALL 被拒绝
- **AND** 不得以投影中的旧值覆盖资源真源

### Requirement: 资源选择确定且与规范节点和错因一致

编排器 SHALL 仅从 active、学生可访问、版本当前且同时匹配规范节点和受控错因的资源中选择候选，并按受版本控制的策略确定性排序。缺少唯一合格候选时 SHALL 返回稳定不可用状态，不得退回默认稳定裕度资源或无关通用内容。

#### Scenario: 多道题复用同一合格资源

- **WHEN** 多个错误选项解析到同一节点和适用错因，且一个资源的审核关系覆盖该集合
- **THEN** 编排器 SHALL 复用同一版本化资源
- **AND** 每条覆盖行仍保留其独立来源题和错因 lineage

#### Scenario: 只有不匹配或不可访问资源

- **WHEN** 候选资源的节点、错因、权限、状态或版本任一不满足要求
- **THEN** 编排器 SHALL 返回 `RESOURCE_UNAVAILABLE` 或 `REFERENCE_DRIFT`
- **AND** 不得创建表面可用的学习任务

### Requirement: 资源投影与覆盖输入绑定同一捕获修订

Git 资源注册输入、数据库 TeachingResource 投影和图谱节点目录 MUST 绑定同一 Git 捕获修订及各自内容摘要。工作树不洁净、数据库投影缺少修订或输入摘要不一致时，严格消费方 SHALL fail closed。

#### Scenario: Git 与数据库投影修订不一致

- **WHEN** 资源投影的数据库 capture revision 不等于覆盖审计的 Git capture revision
- **THEN** 系统 SHALL 报告 `REFERENCE_DRIFT`
- **AND** 不得把任何受影响资源计入完整覆盖

### Requirement: v2 资源投影覆盖全部当前错误选项错因

系统 SHALL 从 `micro-tutoring-option-attributions-v2`（工件版本 `micro-tutoring-option-attributions.v3`）派生独立的 v2 资源投影文件 `micro-tutoring-resource-projection-v2.json`，版本为 `micro-tutoring-resource-projection.v2`。投影 MUST 覆盖该目录中每个唯一 `knowledgeNodeId` 与 `misconceptionTag` 对，使 v2 分母中每个错误选项都能解析到至少一个当前有效、学生可见、可启动的学习资源。v1 资源投影文件 `micro-tutoring-resource-projection.json` 与资格回执 MUST 保持只读历史兼容，不得被原地扩写。

#### Scenario: 当前 v2 错因都有合格资源

- **WHEN** 加载当前 v2 选项归因目录与资源投影
- **THEN** 每个唯一节点/错因对都有一条学生可见资源关系
- **AND** 每个 v2 错误选项都能解析到至少一个合格资源动作

#### Scenario: 资源授权撤销

- **WHEN** 匹配资源的学生可见性被撤销或 registry 身份不再有效
- **THEN** 编排器 SHALL 返回稳定不可用原因
- **AND** 不得继续创建可启动的学习任务

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

