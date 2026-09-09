## MODIFIED Requirements

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
- **THEN** 界面 SHALL 并列呈现各候选的策略、画像依据、核心节点与顺序、OSS 核心资源与类型占比、Runtime 读取状态、时长与检查点安排
- **AND** 逐节点绑定状态与失败原因 SHALL 随比较投影一并呈现
- **AND** 呈现与持久化批次 SHALL 一致。

## ADDED Requirements

### Requirement: Path candidate nodes carry explicit runtime resource bindings
候选路径节点 SHALL 以独立于导航 target 的绑定字段携带 runtime 资源身份，节点导航 target 保持学生可导航站内路由不变。

#### Scenario: Binding field is separate from navigation target
- **WHEN** 候选节点绑定 Runtime 教学资源
- **THEN** 节点 SHALL 同时携带学生可导航 target 与 runtime 资源绑定字段
- **AND** 绑定字段 SHALL 包含对象键或 blob 内容键、runtime release 标识与资源 ID
- **AND** 导航 target 的 destination contract 校验 SHALL NOT 因绑定存在而改变。

#### Scenario: Binding source of truth is the active runtime release
- **WHEN** 解析节点绑定
- **THEN** 绑定对象键 SHALL 来自活动 Runtime release manifest 真实持有的键集合
- **AND** 教学投影仅提供资源身份与内容引用，SHALL NOT 替代 release 可用性判定
- **AND** SHALL NOT 以模糊匹配构造绑定。
