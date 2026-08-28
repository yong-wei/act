# reviewed-assessment-generation-governance Specification

## Purpose
TBD - created by archiving change reconcile-reviewed-assessment-generation-governance. Update Purpose after archive.
## Requirements
### Requirement: 生成审核合同只有在实现证据一致时才合格

生成审核治理 SHALL 绑定一个合同身份、canonical spec revision、实现 revision、测试集合、任务证据、归档路径和关联 Issue 状态。只有这些证据指向同一行为版本且全部可回读时，治理结果才 MAY 标记为 `QUALIFIED`。

#### Scenario: 所有收口证据一致

- **WHEN** 代码、针对测试、tasks、archive、Issue 状态和 publication receipt 均绑定同一合同与 source revision
- **THEN** 系统 SHALL 产生可追溯的 `QUALIFIED` reconciliation receipt
- **AND** receipt SHALL 记录 catalog、审核和版本化发布证据的引用而不包含敏感原文。

#### Scenario: Issue 已关闭但实现证据不完整

- **WHEN** 关联 Issue 为 closed/archived 但代码、测试、tasks、archive 或 catalog publication 证据缺失或漂移
- **THEN** 治理结果 SHALL 保持 `NOT_QUALIFIED`
- **AND** 不得仅凭 GitHub 状态宣称候选审核发布已完成。

### Requirement: 生成来源必须真实区分临时模板与可治理候选

评估生成入口 SHALL 在最早边界写入不可混淆的 generation kind。固定模板生成的临时练习 MUST 标为 `template-practice` 或等价 truthful discriminator；模型生成、人工编写和既有导入题 MUST 使用各自真实来源。内存 `Map`、客户端字段或历史 `ai_generated` 字符串不得授予候选、目录或 mastery 权限。

#### Scenario: 固定模板生成临时练习

- **WHEN** 运行时固定模板构造一条低风险练习
- **THEN** 响应和内部记录 SHALL 使用 truthful template kind
- **AND** 该对象 SHALL 保持 practice-only，不得伪装为 AI 候选或进入 path-eligible catalog。

#### Scenario: 模型生成候选

- **WHEN** 授权生成服务使用模型产生候选
- **THEN** 候选 SHALL 绑定 provider/model/config、输入来源、内容 hash 和 revision identity
- **AND** 它 SHALL 进入审核流水线而不得直接成为目录项目或正式评估答案。

### Requirement: 治理复用唯一候选到目录流水线

生成审核治理 SHALL 复用既有 candidate、review decision、assessment catalog item 和 publication receipt identity。若已有实现缺失某一阶段，补齐必须落在同一合同和同一 lineage 中；不得新增第二套 candidate schema、状态机、目录或 exporter。

#### Scenario: 现有候选流水线可回读

- **WHEN** 对账发现候选、独立人工审核、版本化目录和 receipt 均可由同一 lineage 读取
- **THEN** reconciliation SHALL 证明该链路而不是复制它
- **AND** 下游 Assessment 只能消费这一个 catalog identity。

#### Scenario: 候选阶段缺失

- **WHEN** 对账发现 precheck、human review、publication 或 lineage 阶段缺失
- **THEN** 实现 SHALL 在既有合同内补齐缺口并增加对应 characterization/回归测试
- **AND** 平行模型或仅 facade 的补丁 SHALL 被拒绝。

### Requirement: 目录资格需要独立人工审核和版本化发布证据

候选只有在确定性预检有效、独立人工审核批准、内容与来源版本未 stale、catalog item 与 publication receipt 可回读后，才 MAY 被阶段政策认定为 path-eligible 或正式评估来源。阶段政策 MUST 拒绝缺少任一证据的候选；普通浏览、模板练习、模型建议和未验证干预不得授予 mastery。

#### Scenario: 批准候选发布

- **WHEN** 发布器读取当前批准且未 stale 的候选 lineage
- **THEN** 它 SHALL 创建不可变 catalog item、版本化 release 和 publication receipt
- **AND** 目录阶段资格 SHALL 继续由现有 stage policy 独立计算。

#### Scenario: 证据不完整或审核过期

- **WHEN** 候选缺少独立批准、publication receipt、来源 hash 或当前审核版本
- **THEN** 目录 SHALL 返回 blocked/provisional 状态
- **AND** 该候选不得用于 readiness、checkpoint、terminal-validation 或高置信 mastery。

