# sixdof-environment-observation Specification

## ADDED Requirements

### Requirement: 种子化可复现环境场

风、波、流环境 MUST 由稳定种子派生的独立子流驱动（训练 seed 20261106、验证 17/29/43）；同一 seed 与工况 MUST 产生同一序列，不同帧率/倍速/暂停/相机操作 MUST NOT 改变物理时钟上的环境演化；关闭某因素噪声 MUST NOT 改变其余随机流（如波面序列）。

#### Scenario: 同 seed 同序列

- **WHEN** 以相同 seed 与工况构造两个环境场并推进相同物理时长
- **THEN** 波面、阵风与传感器噪声序列逐点一致

### Requirement: 波场统计与作用一致

波场 MUST 为带种子的 JONSWAP 多向离散场（离散后重新归一化至 `Σa_i²/2 = Hs²/16`）；波面、轨道速度与船体一阶激励 MUST 共用同一波场（同相位）；二阶载荷在 QTF 未验证前 MUST 显式标注不可用且 MUST NOT 伪造慢漂；关闭二阶 MUST NOT 改变波面序列。

#### Scenario: 波能守恒

- **WHEN** 统计波面序列的零阶矩 m0
- **THEN** m0 与 Hs²/16 在统计容差内一致

#### Scenario: 一阶力与波面同相

- **WHEN** 同时输出波面与对应频率的一阶激励
- **THEN** 两者相位关系由同一波场决定，不存在独立相位源

### Requirement: 风载与消融开关语义

风载 MUST 采用分量式气动模型（Fujiwara 2005 形式，T 级系数）经相对风计算：真风 FROM 真北顺时针转换为 NED 后，减去船体运动与 `ω×安装点`；`wind_force_enabled=false` MUST 使气动力贡献归零而 MUST NOT 移除水动力阻尼；`enabled=true` 且真风为零时 MUST 保留航行相对气流；两种状态 MUST NOT 在界面上混称"无风"。

#### Scenario: 消融关闭归零

- **WHEN** `wind_force_enabled=false` 且阵风运行
- **THEN** 风力/力矩输出为零，船体水动力阻尼不变

#### Scenario: 静风航行仍有相对气流

- **WHEN** 真风为零、船以巡航速度前进且 `enabled=true`
- **THEN** 相对风等于负船速，产生迎风阻力

### Requirement: 恒定均匀流语义

课程工况 C1/C2 MUST 为空间均匀、时间恒定的水平流；船体、桨、舵、鳍 MUST 从同一流场取局部来流；对水与对地速度 MUST 分开输出；流的作用 MUST 仅经相对流速路径进入（MUST NOT 叠加同义流扰动力）；未经验证的空间剪切 MUST NOT 混入正式工况。

#### Scenario: 对地对水分离

- **WHEN** 恒定流存在
- **THEN** 对地速度=对水速度+流矢，轨迹按对地速度演化，载荷按对水速度计算

### Requirement: 真值→传感器→控制器观测链

测量 MUST 按安装点量测后经采样、白噪声、偏置 OU、量化与时延队列输出 `(t_sample, t_arrive, quality)`；控制器 MUST 只读合法测量；N0 MUST 保留观测 API 仅关闭误差；N2 为 N1 误差×2；故障注入 MUST 具物理连续性——缺测 MUST NOT 以 0 填充、驱动停 MUST NOT 使轴系瞬停、卡滞 MUST NOT 使角度瞬移；低风速方向无定义 MUST 标 quality 而非 0°。

#### Scenario: 噪声影响控制动作

- **WHEN** 同一控制器分别接入 N0 与 N1 观测
- **THEN** 控制输出序列不同（噪声真实进入反馈）

#### Scenario: 缺测非零

- **WHEN** GNSS 缺失窗口内读取位置测量
- **THEN** 输出 quality=缺失且不产生 0 值样本，恢复后按队列时延正常
