# student-model-evaluation Specification

## Purpose
TBD - created by archiving change issue-2148-p1. Update Purpose after archive.
## Requirements
### Requirement: StudentModel 与物理后台隔离

StudentModel MUST 作为独立的有版本模型工件存在，MUST NOT 驱动物理状态、3D 表现或改写 TruthPlant 输出；三种比较模式（船体验证/命令到输出/独立闭环）MUST 保持学生侧与物理侧的隔离——C 模式理想侧 MUST NOT 读取物理侧误差信号。

#### Scenario: 学生模型仅预测

- **WHEN** StudentModel 在任何比较模式下运行
- **THEN** 其输出仅用于预测曲线展示与残差分析，不影响 TruthPlant 状态

### Requirement: 辨识算法固定

辨识 MUST 采用输出误差最小二乘（ZOH 离散化推进），多初值有界优化；参数到达边界、激励不足或病态时 MUST 返回「未能可靠识别」（不返回默认参数替代）；辨识失败 MUST NOT 自动替换为预设参数。

#### Scenario: 激励不足返回失败

- **WHEN** 输入信号为零或恒定（无激励）
- **THEN** 返回辨识失败状态及原因

### Requirement: 评价指标固定

RMSE 与峰值误差 MUST 按共同时间窗计算；FIT MUST 为 `100*(1−‖y−ŷ‖/‖y−ȳ‖)`，可负且 MUST NOT 裁剪；分母近零时 MUST 返回不适用；阶跃超调 MUST 相对 `Δy=yref−y0`（支持负阶跃/非零初值）；调节时间 MUST 从参考事件起计且 MUST NOT 用末端单点入带判定成功；角度误差 MUST 正确 unwrap（179° vs −179° 差值 2° 而非 358°）。

#### Scenario: FIT 可为负

- **WHEN** 模型预测比均值更差
- **THEN** FIT 为负值，不裁剪为 0

#### Scenario: 角度跨界正确

- **WHEN** 预测 179° / 测量 −179°
- **THEN** 误差为 2° 而非 358°

