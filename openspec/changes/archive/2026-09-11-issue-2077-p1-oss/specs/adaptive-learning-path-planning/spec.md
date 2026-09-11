## ADDED Requirements

### Requirement: Path generation snapshots the live published resource index
路径规划开始前 SHALL 读取当前活 `PublishedResourceFeatureIndex` 与活动 Runtime release，并将本次输入快照随生成结果保存。快照 SHALL 能追溯每个参与规划的已发布资源的 resourceId、内容版本或校验值、对象键或 sourcePath，以及 Runtime release。索引、活投影或活动 release 不可用时，生成 SHALL 失败关闭，SHALL NOT 静默改用未挂接发布索引的本地默认登记表。

#### Scenario: Snapshot is recorded before assembly
- **WHEN** 一次候选路径生成开始
- **THEN** 服务端 SHALL 先加载活发布资源索引与活动 Runtime release
- **AND** 生成结果 SHALL 包含本次 `planningResourceSnapshot`（indexId、projectionId、projectionHash、runtimeReleaseId，以及 recommendable 资源的 resourceId 与内容版本/对象键或 sourcePath）
- **AND** 装配与排序 SHALL 消费该快照对应的已发布节点，而不是仅在生成后再挂一个公共投影对象。

#### Scenario: Missing published index fails closed
- **WHEN** 活发布资源索引、约定教学投影或活动 Runtime release 无法读取
- **THEN** 生成 SHALL 返回明确失败
- **AND** SHALL NOT 继续用未挂接发布索引的本地候选源产出成功三条路径。

### Requirement: Published resources are not type-capped after requirements
在规划需求已满足之后，规划器 SHALL 继续接纳尚未入选、且有助于策略区分的 recommendable 已发布资源。SHALL NOT 仅因为路径上已有同类型已发布资源就拒绝后续已发布节点。统一先修、公共终点与 sharedRequired 节点仍可共享，且不计入区分度。

#### Scenario: Second published card can enter a path
- **WHEN** 一条候选路径已包含一张已发布知识卡，且时间预算与目标覆盖仍允许另一张不同的 recommendable 知识卡
- **THEN** 规划器 SHALL 允许该第二张卡入选
- **AND** 优先选择尚未被同批其他策略路径占用的已发布资源。

## MODIFIED Requirements

### Requirement: Control-correction planner returns three path styles
The path planner SHALL provide a directly comparable three-style path bundle for control-correction diagnosis when sufficient resources and evidence exist. The number of serialized candidate options SHALL equal the goal's target option count (three) whenever a policy-family request is present, including starter injection and low-confidence fallback paths; the primary planning family SHALL NOT be appended as an additional candidate beyond the requested families.

#### Scenario: Three-style bundle is generated
- **WHEN** a student opens the control-correction path center from diagnosis or adaptive practice
- **THEN** the system SHALL display available path styles with style id, policy family, target deficits, estimated effort, resource mix, terminal validation strategy, evidence basis, and limitations
- **AND** the serialized option count SHALL equal three (`optionCount === 3`)
- **AND** unavailable or insufficient path diversity SHALL be represented as fallback state rather than three cosmetic cards.

#### Scenario: Starter injection keeps the option count fixed
- **WHEN** the planner auto-injects starter policy families because the learner state is missing, confidence is low, or evidence count is at most one
- **THEN** the candidate bundle SHALL contain exactly the requested starter families and the target option count (three) SHALL NOT be exceeded
- **AND** the primary `rules-plus-graph-search` route SHALL NOT be appended as an extra candidate option.

#### Scenario: Resources are insufficient
- **WHEN** the planner cannot produce meaningfully distinct path options that satisfy the hard OSS diversity gates
- **THEN** it SHALL return an explicit `insufficient-candidate-diversity` result with reasons
- **AND** it SHALL NOT show three cosmetic variants with materially identical resources
- **AND** it SHALL NOT compensate for unavailable diversity by adding a fourth route beyond the requested families.

### Requirement: Candidate batches carry quantified pairwise differentiation metrics
候选路径批次 SHALL 在装配时对每对候选路径计算量化区分度指标并持久化。"高区分度个性化推荐成功"标记与成功的三条候选 SHALL 仅在硬门禁全部满足时给出。强制先修、公共终点和 sharedRequired 节点 SHALL 不计入区分度。

#### Scenario: Pairwise metrics are computed and persisted
- **WHEN** 一个候选批次完成装配
- **THEN** 服务端 SHALL 对每对候选路径计算：核心节点集合 Jaccard 距离、核心 OSS/已发布资源集合 Jaccard 距离、资源类型分布总变差距离、共有节点归一化顺序差异、预计时长相对差、检查点结构性差异、不同可个性化核心节点数
- **AND** 指标 SHALL 随候选批次持久化并在响应中返回
- **AND** 统一先修节点与统一终结验证节点 SHALL 不计入区分度统计。

#### Scenario: Successful three-path generation requires hard diversity
- **WHEN** 生成要被标记为成功的三条候选
- **THEN** 任意两条路径在排除公共强制节点后的 Jaccard 相似度 SHALL ≤ 30%（即现有 Jaccard 距离 ≥ 0.70）
- **AND** 每条路径 SHALL 至少包含 2 个其他路径没有的已发布/OSS 资源身份
- **AND** 每条路径独有已发布/OSS 资源占其非强制资源的比例 SHALL ≥ 50%
- **AND** 每条路径至少有 1 个独有已发布/OSS 资源位于路径前半段
- **AND** 任意两条路径的前两个非强制资源 SHALL NOT 完全相同
- **AND** 未满足任一条款时 SHALL NOT 标记高区分度，SHALL NOT 通过复制路径或替换非核心标签凑足三条。

#### Scenario: Refresh and reorder do not drift
- **WHEN** 学生刷新页面、重新打开候选 URL 或改变候选展示顺序
- **THEN** 差异结论、资源来源与读取证据 SHALL 来自服务端持久化批次且不发生漂移。

### Requirement: The three candidate strategies are portrait-driven
三条候选路径 SHALL 分别承载薄弱点补强、偏好资源强化、优势迁移应用策略，其节点与资源选择 SHALL 由当前学生画像的可解释事实驱动。

#### Scenario: Strategies expose portrait basis
- **WHEN** 候选路径生成完成
- **THEN** 每条候选 SHALL 标明其策略名、驱动该策略的画像事实与证据状态
- **AND** 薄弱点补强路径 SHALL 至少包含 2 个针对画像薄弱知识点的基础/诊断已发布资源
- **AND** 优势迁移路径 SHALL 至少包含 2 个仿真、工作台、案例或综合应用已发布资源
- **AND** 偏好匹配路径的非强制资源中至少 60% SHALL 匹配画像偏好，并至少包含 2 个独有偏好已发布资源。

#### Scenario: Portrait unavailable degrades honestly
- **WHEN** 画像不可用、过期或证据不足
- **THEN** 候选 SHALL 标记为通用/受限而非伪造个性化策略
- **AND** 页面 SHALL 说明当前只能生成通用或受限路径。

#### Scenario: Single-variable portrait changes alter the plan reproducibly
- **WHEN** 受控画像下仅改变薄弱点、资源偏好或优势能力之一并重新装配
- **THEN** 对应策略候选的核心节点或已发布/OSS 资源 SHALL 发生可解释变化且其余条件保持一致
- **AND** 参与规划的已发布资源集合 SHALL 发生可观测变化
- **AND** 同一输入的重复装配 SHALL 产生相同结果。

### Requirement: Candidate OSS resources carry runtime provenance and read verification
计入路径覆盖与区分度的候选资源 SHALL 经由节点级 runtime 资源绑定解析到当前生效 Runtime release 的对象键并通过读取验证；绑定缺失、release 缺位或验证失败 SHALL 显式记录与呈现，SHALL NOT 静默退回或产生无解释的空记录。

#### Scenario: Object keys resolve from the active runtime
- **WHEN** 候选路径包含可绑定 Runtime 教学资源的节点
- **THEN** 每个该节点 SHALL 携带由教学投影确定性身份规则与活动 Runtime release manifest 连接解析出的 runtime 资源绑定（对象键或 blob 内容键、runtime release 标识、资源 ID、资源类型）
- **AND** 读取验证 SHALL 消费该绑定字段，SHALL NOT 从节点导航 target 字符串反解对象键
- **AND** 批次定稿 SHALL 产出读取验证记录（Runtime release、资源 ID、对象键、校验值、候选路径/节点 ID、时间、结果）。

#### Scenario: Unresolvable bindings are recorded with explicit reasons
- **WHEN** 节点资源无法绑定到活动 Runtime release（无 runtime 身份、活动 release 未持有该键、无活动 release）
- **THEN** 批次元数据 SHALL 逐节点记录绑定状态与失败原因
- **AND** 候选池诊断 SHALL 按资源族报告可绑定 OSS 资源计数
- **AND** 批次内无任何可用 OSS 资源时 SHALL 标记受限并呈现原因，SHALL NOT 静默返回空读取记录。

#### Scenario: Faulty resources are excluded and surfaced
- **WHEN** 某核心资源对象不存在、权限拒绝或校验失败
- **THEN** 该资源 SHALL NOT 计入覆盖与区分度
- **AND** 页面 SHALL 显示该资源与可理解的失败原因
- **AND** 可用资源不足以支撑候选门槛时 SHALL 返回真实的资源不足限制。

#### Scenario: Comparison view presents provenance and differences
- **WHEN** 学生查看候选比较
- **THEN** 界面 SHALL 并列呈现各候选的策略、画像依据、核心节点与顺序、OSS 核心资源与类型占比、明确的资源身份与 Runtime 读取状态、时长与检查点安排
- **AND** 逐节点绑定状态与失败原因 SHALL 随比较投影一并呈现
- **AND** 呈现与持久化批次及规划输入快照 SHALL 一致。
