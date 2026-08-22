# micro-intervention-learning-evidence Specification

## Purpose
TBD - created by archiving change contribute-micro-intervention-evidence-to-adaptive-learning. Update Purpose after archive.
## Requirements
### Requirement: 微干预证据通过 append-only 投影产生

系统 SHALL 从已封存的微干预结果异步、幂等地产生学习证据投影，不得在验证提交事务中直接修改掌握度或路径。投影 MUST 绑定 learner/course、学习目标、Canonical 知识节点、来源答案、干预、验证题内容身份、捕获修订和算法版本，并支持相同输入确定性重放。

#### Scenario: 独立验证结果进入证据投影

- **WHEN** 一个微干预具有当前、服务端验证且身份完整的独立验证结果
- **THEN** projector SHALL 创建唯一候选学习证据和 lineage
- **AND** 重复投递 SHALL 返回同一投影而不重复贡献

#### Scenario: 治理身份漂移或不完整

- **WHEN** outcome 的节点、Authority/Projection、题目或 capture identity 无法核验
- **THEN** projector SHALL 记录可审计 drift/limitation
- **AND** 不得创建部分 LearningFact 或更新掌握度

### Requirement: 参与事件与学习验证具有不同证据权威

资源打开、学习动作完成、提示请求、停留时间和客户端完成标记 SHALL 仅作为参与上下文，profile contribution MUST 为零。只有服务端封存的独立验证结果 MAY 产生 assessment-backed 候选证据，且其权重、置信度和用途 SHALL 由版本化政策决定。

#### Scenario: 学生只完成学习动作

- **WHEN** 干预记录资源动作完成但没有有效独立验证结果
- **THEN** 系统 MAY 保留 context-only 事实
- **AND** 不得提高 mastery 或跳过后续评估

#### Scenario: 学生完成独立验证

- **WHEN** 当前独立验证结果通过治理核验
- **THEN** 系统 MAY 产生有界 assessment-backed 证据
- **AND** 单次结果不得自行确认终结性掌握

### Requirement: 重复、衰减和冲突处理可重放

微干预证据政策 SHALL 定义重复验证间隔、单次贡献上限、时间衰减、相互冲突结果、撤销和算法版本迁移。相同事件集合与算法版本 MUST 产生相同证据摘要；策略变化 SHALL 通过新算法版本重算，不得改写历史 outcome。

#### Scenario: 短期重复通过同类验证

- **WHEN** 学生在受控时间窗内多次完成高度相关验证
- **THEN** 政策 SHALL 抑制重复贡献并保留全部 lineage
- **AND** 不得按事件数量线性增加 mastery

#### Scenario: 后续验证与先前结果冲突

- **WHEN** 当前失败结果与先前通过结果冲突
- **THEN** 重算 SHALL 按版本化 freshness/conflict 政策降低置信度或要求再验证
- **AND** 下游 SHALL 看到 limitation

### Requirement: 微干预证据投影保护私有学习数据

私有投影 MAY 保留授权计算所需内部引用，但学生投影和公开治理报告 MUST 排除原始答案、选项正文、提示正文、用户标识和可逆 option 引用。聚合报告 SHALL 按独立学习者执行小样本抑制。

#### Scenario: 生成公开微干预证据报告

- **WHEN** 系统汇总证据质量、通过率或路径影响
- **THEN** 报告 SHALL 只包含抑制后的聚合计数和不可逆治理身份
- **AND** 不得输出可还原个人作答或提示内容的数据
