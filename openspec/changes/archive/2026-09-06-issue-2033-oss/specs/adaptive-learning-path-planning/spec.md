## ADDED Requirements

### Requirement: Candidate batches carry quantified pairwise differentiation metrics
候选路径批次 SHALL 在装配时对每对候选路径计算量化区分度指标并持久化，"高区分度个性化推荐成功"标记 SHALL 仅在至少一对比较满足阈值组合时给出。

#### Scenario: Pairwise metrics are computed and persisted
- **WHEN** 一个候选批次完成装配
- **THEN** 服务端 SHALL 对每对候选路径计算：核心节点集合 Jaccard 距离、核心 OSS 对象键集合 Jaccard 距离、资源类型分布总变差距离、共有节点归一化顺序差异、预计时长相对差、检查点结构性差异、不同可个性化核心节点数
- **AND** 指标 SHALL 随候选批次持久化并在响应中返回
- **AND** 统一先修节点与统一终结验证节点 SHALL 不计入区分度统计。

#### Scenario: High-differentiation label requires threshold compliance
- **WHEN** 任一对候选的达标指标少于 7 项中的 3 项
- **THEN** 该批次 SHALL NOT 被标记为"高区分度个性化推荐成功"
- **AND** 服务端 SHALL NOT 通过复制路径或替换非核心资源凑足三条。

#### Scenario: Refresh and reorder do not drift
- **WHEN** 学生刷新页面、重新打开候选 URL 或改变候选展示顺序
- **THEN** 差异结论、资源来源与读取证据 SHALL 来自服务端持久化批次且不发生漂移。

### Requirement: The three candidate strategies are portrait-driven
三条候选路径 SHALL 分别承载薄弱点补强、偏好资源强化、优势迁移应用策略，其节点与资源选择 SHALL 由当前学生画像的可解释事实驱动。

#### Scenario: Strategies expose portrait basis
- **WHEN** 候选路径生成完成
- **THEN** 每条候选 SHALL 标明其策略名、驱动该策略的画像事实与证据状态
- **AND** 薄弱点补强路径 SHALL 优先覆盖有充分证据的主要缺口，偏好资源强化路径 SHALL 提升画像偏好资源类型占比，优势迁移路径 SHALL 采用画像优势能力支持的综合或仿真任务。

#### Scenario: Portrait unavailable degrades honestly
- **WHEN** 画像不可用、过期或证据不足
- **THEN** 候选 SHALL 标记为通用/受限而非伪造个性化策略
- **AND** 页面 SHALL 说明当前只能生成通用或受限路径。

#### Scenario: Single-variable portrait changes alter the plan reproducibly
- **WHEN** 受控画像下仅改变薄弱点、资源偏好或优势能力之一并重新装配
- **THEN** 对应策略候选的核心节点或 OSS 资源 SHALL 发生可解释变化且其余条件保持一致
- **AND** 同一输入的重复装配 SHALL 产生相同结果。

### Requirement: Candidate OSS resources carry runtime provenance and read verification
计入路径覆盖与区分度的候选资源 SHALL 解析到当前 Runtime 的 OSS 对象键并通过读取验证，验证失败 SHALL 如实呈现且不被掩盖。

#### Scenario: Object keys resolve from the active runtime
- **WHEN** 候选路径包含 Runtime 教学资源
- **THEN** 每个资源 SHALL 解析到当前生效 Runtime manifest 中的对象键
- **AND** 批次定稿 SHALL 产出读取验证记录（Runtime release、资源 ID、对象键、校验值、候选路径/节点 ID、时间、结果）。

#### Scenario: Faulty resources are excluded and surfaced
- **WHEN** 某核心资源对象不存在、权限拒绝或校验失败
- **THEN** 该资源 SHALL NOT 计入覆盖与区分度
- **AND** 页面 SHALL 显示该资源与可理解的失败原因
- **AND** 可用资源不足以支撑候选门槛时 SHALL 返回真实的资源不足限制。

#### Scenario: Comparison view presents provenance and differences
- **WHEN** 学生查看候选比较
- **THEN** 界面 SHALL 并列呈现各候选的策略、画像依据、核心节点与顺序、OSS 核心资源与类型占比、Runtime 读取状态、时长与检查点安排
- **AND** 呈现与持久化批次 SHALL 一致。
