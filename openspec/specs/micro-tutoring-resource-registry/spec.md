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

