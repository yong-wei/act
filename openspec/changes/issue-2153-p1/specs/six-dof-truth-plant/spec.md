# six-dof-truth-plant Specification

## ADDED Requirements

### Requirement: 七船唯一六自由度真值后台

每艘船的在线物理推进 MUST 由唯一 TruthPlant 承载，状态 MUST 包含 NED 位置、单位四元数姿态、六自由度体速度、辐射状态、执行器状态与专属状态；运动学 MUST 满足 `etaDot=J(eta)nu`，动力学 MUST 采用含辐射记忆与相对流速（含 `nu_current_bodyDot`）的六自由度结构。教学步骤 MUST NOT 更换模型类型或删除状态；关闭环境因素后非线性耦合、质量、惯性与真实执行器 MUST 仍然存在。

#### Scenario: 关闭风浪流后仍是同一真值模型

- **WHEN** 教学步骤关闭风浪流因素并继续运行
- **THEN** 同一 TruthPlant 继续输出六自由度状态，仅环境作用项为零

#### Scenario: 低速与倒航不掩盖奇异

- **WHEN** 船舶处于零速、侧移或倒航工况
- **THEN** 载荷由 cross-flow 与四象限连续模型产生，MUST NOT 以速度下限截断规避奇异数值

### Requirement: 执行器为物理子系统

推进器 MUST 以轴动力学（`J_s omegaDot = Q_motor - Q_prop - Q_friction`）与扭矩/功率/转速/变化率约束求解；舵/鳍/吊舱 MUST 为带幅值与速率限幅的伺服动态，载荷 MUST 使用实际角度与含流场、波浪轨道速度与桨后流的局部来流；功率 MUST NOT 由最大推力倍乘生成。

#### Scenario: 命令与实际分离

- **WHEN** 学生下发舵令或转速命令
- **THEN** 系统记录命令值与实际执行器状态两者，载荷由实际值产生

### Requirement: 三层模型职责固定

TruthPlant MUST 是唯一驱动三维表现、真实轨迹、物理事件与事后真值评价的层；传感器层 MUST 只向学生控制器提供带噪声/偏置/时延的测量或估计，MUST NOT 暗中使用真值；学生辨识的低阶模型 MUST 仅用于预测与控制设计，MUST NOT 替代或改写真值状态。

#### Scenario: 测量含噪而真值干净

- **WHEN** 同一运行同时输出真值与传感器通道
- **THEN** 噪声只出现在传感器通道，真值通道不受噪声影响

### Requirement: 数值与证据合同

在线物理 MUST 由 Rust/WASM 唯一推进；首版积分 MUST 为 RK4、标称步长 1/120 s，刚性接触 MUST 按 `dt <= 0.1/sqrt(k/m_eff)` 细分（不超过 1/960 s），超出预算 MUST 显式报告而 MUST NOT 裁剪状态伪装稳定。一次运行 MUST 冻结模型版本、参数包哈希、环境/传感器/课程版本、步骤、控制器工件、初始状态、因素掩码与种子；非有限状态、物理不可行与越出适用域 MUST 分类报告，采样层 MUST NOT 把非有限值静默替换为零并把错误运行计为成功。

#### Scenario: 步长收敛证据

- **WHEN** 以 1/120 s 与 1/240 s 步长重复同一算例
- **THEN** 主要指标差小于 1%，或附接触细分收敛证据说明

#### Scenario: 非有限状态不再归零计分

- **WHEN** 内核输出非有限状态
- **THEN** 运行以 non-finite-state 错误终止并保留诊断，MUST NOT 以零值样本继续计为成功运行

### Requirement: 力与力矩分项输出与载荷不重复

TruthPlant MUST 输出物理力/力矩分项（船体黏性、执行器、风、一阶/二阶波浪、辐射、恢复、专属）供教学对照与事后评价；环境载荷 MUST NOT 重复计入——恒定流经相对来流改变船体/桨/舵载荷后 MUST NOT 再叠加同义流扰动力，一阶波浪激励与瞬时波面积分 Froude–Krylov MUST NOT 同时计入，低速过渡两侧 MUST 共用同一力基准。

#### Scenario: 载荷分项可对账

- **WHEN** 检查一次运行的输出
- **THEN** 各力/力矩分项与总载荷可对账，无同义环境载荷重复计入

### Requirement: 频率与时钟合同

航向/航速控制 MUST 以 20Hz、DP 控制 MUST 以 10Hz 执行，传感器按各自采样率工作；记录主通道 MUST 为 20Hz，接触/故障/饱和事件 MUST 另记精确时间；各随机过程 MUST 按各自物理时钟更新，MUST NOT 在积分子阶段重复抽样；倍速 MUST 只改变墙钟推进量，暂停/继续与不同帧率 MUST NOT 改变同一仿真时刻的数值。

#### Scenario: 子步内不重复抽样

- **WHEN** 一个积分步内包含多个 RK 子阶段
- **THEN** 环境随机过程在该步内只按其物理时钟推进一次

### Requirement: 参数来源分级与诚实标注

参数包 MUST 逐字段标注 P（公开原型事实）/B（公开基准数据）/D（求解或辨识得到）/T（教学标称假设）来源；在关键参数包、适用范围与许可证齐全之前，对应船 MUST NOT 被标注为高保真教学验收完成；MUST NOT 把公开外形尺寸与任意系数包装为实名实船校准。

#### Scenario: 教学标称参数如实标注

- **WHEN** 某船参数包含 T 级教学假设值
- **THEN** 该船呈现为教学研究模型而非实船校准数字孪生

### Requirement: 现有资产复用与收敛

`destroyer_hifi` 的非线性受力、辨识对照与噪声资产 MUST 经审查后复用升级（含回转半径定义、湿面积量纲、常量推力与符号约定的核验）；`vessel-drives` MUST 收敛为配置与命令适配器，MUST NOT 维护第二组物理真值；旧低阶内核 MAY 保留为学生模型或基准测试用途。

#### Scenario: 不因名称免检

- **WHEN** 审查现有内核资产
- **THEN** 以量纲、来源与调用事实为准，MUST NOT 仅因命名（如 hifi）或 profile 字面（如 Nomoto）认定其高低保真
