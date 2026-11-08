# student-model-evidence 变更（issue-2152-p1 阶段 1）

## ADDED Requirements

### Requirement: 学生辨识工件版本化持久化

系统 MUST 以 `StudentModelArtifact` 行保存学生辨识工件：同一
(userId, experimentKey, lineageKey) 下 version 严格递增、只增不改；
重新辨识 MUST 生成新行并保留全部历史行；工件 MUST 携带服务端计算的
规范序内容哈希；训练与验证窗口引用 MUST 记录 runRef 与起止秒，同一
runRef 上的训练/验证窗口 MUST NOT 重叠。

#### Scenario: 重新辨识保留历史

- **WHEN** 学生对同一 lineageKey 保存第二次辨识结果
- **THEN** 旧行内容不变，新行 version = 旧行 version + 1，两行均可读取

#### Scenario: 窗口重叠拒绝

- **WHEN** 保存载荷中训练窗口与验证窗口在同一 runRef 上重叠
- **THEN** 保存失败并返回通用中文错误，不写入任何行

### Requirement: 契约与 Rust 内核对齐

TS 契约的 ModelStructure 判别联合 MUST 与 Rust `ModelStructure` serde
输出逐字对齐（snake_case kind 标签：nomoto1/nomoto2/fopdt/
roll_oscillator/dp_low_freq3）；数值字段 MUST 拒绝非有限值；
dp_low_freq3 的矩阵 MUST 为恰好 9 个有限数。

#### Scenario: Rust serde 样例通过

- **WHEN** 输入任一 Rust 结构的 serde JSON 样例
- **THEN** 契约校验通过且往返无损

#### Scenario: NaN 拒绝

- **WHEN** structure 任一数值字段为 NaN/Infinity
- **THEN** 契约校验失败

### Requirement: 对照工件绑定与所有权

ComparisonArtifact MUST 绑定本人 StudentModelArtifact 与物理 run 引用；
mode MUST 为 hull_model / command_to_output / independent_closed_loop
之一；引用不属于本人的 studentModelId 时 MUST 返回 404 且不泄露他人
工件存在性；所有读取 MUST 仅返回本人工件。

#### Scenario: 跨用户引用拒绝

- **WHEN** 用户 A 提交引用用户 B 工件的 comparison
- **THEN** 响应 404，不创建行
