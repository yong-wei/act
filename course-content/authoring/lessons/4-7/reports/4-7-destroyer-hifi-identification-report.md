# 4-7 055 型驱逐舰高保真辨识与控制器对比报告

本报告为 4-7 讲义的高保真辨识与控制器对比附证包。讲义精选其中的分段辨识、传统设计四联图、典型航迹和扰动边界结论，完整 24 张控制器航向与航迹对比图保留在本报告中。

## 模型边界

- 高保真模型：055 型驱逐舰，MMG3DOF。
- 重建口径：MMG_REBUILT_FROM_EXISTING_SIMULATION_PROFILE。
- 尺度参数：船长 180 m，型宽 20 m，吃水 6.6 m，排水量 13000 t。
- 任务速度：15.0 m/s（约 29.2 kn）；舵角限制 35 deg，舵速限制 5.0 deg/s。

Rust 实现迁移了现有虚拟仿真中的 MMG 三自由度结构，状态为纵向速度、横向速度、艏摇角速度、位置与航向；外力入口保留 surge force、sway force 与 yaw moment 三个分量。它不是舰船实测水池模型，而是面向课程实验的高保真代理模型。

公开导出的轨迹数据全部使用实际工程量纲：航向角为 deg，航向角速度为 deg/s，航速为 m/s，航迹为 m。内部用于 MMG 水动力系数计算的无量纲量不作为报告输出。

## 传递函数辨识

辨识模型沿用讲义主线中可用于控制器设计的三阶结构，但这次不再把三阶分母一次性拟合，而是按物理含义分成舵机惯性、船体惯性和航向积分：

$$
\delta_c \rightarrow \frac{1}{T_r s+1} \rightarrow \delta \rightarrow \frac{K_h}{T_h s+1} \rightarrow r \rightarrow \frac{1}{s} \rightarrow \psi
$$

- 舵机惯性时间常数 $T_r=1.10$ s
- 船体惯性时间常数 $T_h=42.00$ s
- 船体艏摇增益 $K_h=0.0700$ rad/s/rad
- 扰动等效惯性时间常数 $T_d=54.00$ s
- 扰动等效舵角增益 $K_d=0.0150$ rad
- 组合后的三阶传递函数归一化增益 $K=0.00151515$
- 航向 RMSE：0.26 deg
- 艏摇角速度 RMSE：0.007 deg/s

分段辨识先用高保真模型的舵阶跃响应估计舵机惯性，再用实际舵角到艏摇角速度的数据估计船体惯性。每张阶跃辨识图同时显示阶跃输入、高保真响应和辨识模型响应。扰动不直接进入舵机，而是先经过一个扰动等效惯性环节，折算成进入船体惯性前的等效舵角扰动。

![舵机惯性阶跃辨识](figures/4-7-rudder-actuator-step-identification.png)

![船体惯性阶跃辨识](figures/4-7-hull-yaw-step-identification.png)

![扰动等效惯性阶跃辨识](figures/4-7-disturbance-step-identification.png)

![高保真模型与辨识模型响应对比](figures/4-7-hifi-vs-identified-response.png)

## 典型航迹测试

| 场景 | 扰动 | 高保真-辨识航向 RMSE | 艏摇角速度 RMSE | 最大舵角 |
| --- | --- | ---: | ---: | ---: |
| zigzag45 | 否 | 6.09 deg | 0.158 deg/s | 35.0 deg |
| turning_ramp | 否 | 0.43 deg | 0.002 deg/s | 10.7 deg |

+45°/-45° 方波与 0° 到 360° 回转斜坡共同覆盖了讲义中的两类典型任务。方波半周期为 300 s，总时长 1200 s；回转斜坡从 60 s 开始单调增加，到 780 s 达到 360°。结果显示，辨识模型能跟随主趋势，但在扰动、连续回转和快速换向下与高保真模型存在可见差异。

![外部扰动接口下的障碍规避响应](figures/4-7-disturbance-response.png)

## 控制器对比

| 控制器 | 方波任务 RMSE | 最大舵角 | 舵角总变化 |
| --- | ---: | ---: | ---: |
| direct_transfer | 32.49 deg | 35.0 deg | 303.8 deg |
| fixed_lead | 32.61 deg | 35.0 deg | 297.4 deg |
| pi_lead | 32.52 deg | 35.0 deg | 302.7 deg |
| lag_lead | 32.07 deg | 35.0 deg | 367.5 deg |
| filtered_pid | 32.89 deg | 35.0 deg | 290.4 deg |
| disturbance_optimized | 32.07 deg | 35.0 deg | 381.8 deg |

综合高保真模型与辨识模型结果，推荐方案为 `pi_lead`。当前高保真评分最优行为 `disturbance_optimized`，其优势来自航向误差、舵角变化和扰动场景之间的折中。

![控制器对比](figures/4-7-controller-comparison.png)

## 讲义比较分组

- 搜索设置：遗传算法粗搜 + 局部精修，种群 48，代数 40，精英 6，交叉率 0.70，变异率 0.18，随机种子 4707。
- 编码字段：结构编号 + kp/ki/kd + 超前强度 + 滞后强度 + 微分滤波系数 + 测量滤波时间常数。
- 航向传感器噪声：`\psi_m(t)=\psi(t)+b_\psi(t)+\sigma_\psi\xi_k`，$b_\psi=0.25^\circ$，$\sigma_\psi=0.35^\circ$。

![传统设计诊断四联图](figures/4-7-traditional-diagnosis-four-panel.png)

![传统设计校正四联图](figures/4-7-traditional-design-four-panel.png)

![辨识模型优化收敛曲线](figures/4-7-optimization-convergence-identified.png)

![高保真模型优化收敛曲线](figures/4-7-optimization-convergence-hifi.png)

![方波名义传统对比](figures/4-7-nominal-traditional-zigzag45.png)

![方波名义优化对比](figures/4-7-nominal-optimized-zigzag45.png)

![回转名义传统对比](figures/4-7-nominal-traditional-turning_ramp.png)

![回转名义优化对比](figures/4-7-nominal-optimized-turning_ramp.png)

![方波扰动对比](figures/4-7-disturbance-controller-zigzag45.png)

![回转扰动对比](figures/4-7-disturbance-controller-turning_ramp.png)

![方波航向噪声对比](figures/4-7-noise-controller-zigzag45.png)

![回转航向噪声对比](figures/4-7-noise-controller-turning_ramp.png)

## 外部扰动接口

外部扰动接口字段为 `forceX, forceY, momentN`，单位为 `N, N, N*m`。实验把横向风浪等效为缓变横向力与艏摇力矩，保留纵向力入口，便于未来迁移到统一 Rust 驱动引擎时由环境模块注入。
本次扰动对比采用 `moderate` 等级，约为满舵艏摇力矩的 44%。轻扰动用于稳态偏差讨论，中等扰动用于抗扰优化，强扰动只用于执行机构余量边界讨论。

扰动控制器对比样本数：24。扰动下的结果说明，即使辨识模型加入了等效扰动惯性通道，低阶模型仍不能完全表达横荡、艏摇、航速和舵效耦合带来的偏差。

## 六种结构的 48 组航向角与航迹图

以下 24 张图均使用确定参数的控制器，并同时在辨识模型与高保真模型上运行。每张图左侧为给定航向、高保真航向和辨识模型航向，单位 deg；右侧为期望航迹、高保真航迹和辨识模型航迹，单位 m。每个控制结构覆盖方波与回转斜坡两个场景，每个场景分别给出无扰动和有扰动两种情况。

### direct_transfer

![direct_transfer zigzag45 无扰动](figures/4-7-controller-direct_transfer-zigzag45-calm.png)

![direct_transfer zigzag45 有扰动](figures/4-7-controller-direct_transfer-zigzag45-disturbed.png)

![direct_transfer turning_ramp 无扰动](figures/4-7-controller-direct_transfer-turning_ramp-calm.png)

![direct_transfer turning_ramp 有扰动](figures/4-7-controller-direct_transfer-turning_ramp-disturbed.png)

### fixed_lead

![fixed_lead zigzag45 无扰动](figures/4-7-controller-fixed_lead-zigzag45-calm.png)

![fixed_lead zigzag45 有扰动](figures/4-7-controller-fixed_lead-zigzag45-disturbed.png)

![fixed_lead turning_ramp 无扰动](figures/4-7-controller-fixed_lead-turning_ramp-calm.png)

![fixed_lead turning_ramp 有扰动](figures/4-7-controller-fixed_lead-turning_ramp-disturbed.png)

### pi_lead

![pi_lead zigzag45 无扰动](figures/4-7-controller-pi_lead-zigzag45-calm.png)

![pi_lead zigzag45 有扰动](figures/4-7-controller-pi_lead-zigzag45-disturbed.png)

![pi_lead turning_ramp 无扰动](figures/4-7-controller-pi_lead-turning_ramp-calm.png)

![pi_lead turning_ramp 有扰动](figures/4-7-controller-pi_lead-turning_ramp-disturbed.png)

### lag_lead

![lag_lead zigzag45 无扰动](figures/4-7-controller-lag_lead-zigzag45-calm.png)

![lag_lead zigzag45 有扰动](figures/4-7-controller-lag_lead-zigzag45-disturbed.png)

![lag_lead turning_ramp 无扰动](figures/4-7-controller-lag_lead-turning_ramp-calm.png)

![lag_lead turning_ramp 有扰动](figures/4-7-controller-lag_lead-turning_ramp-disturbed.png)

### filtered_pid

![filtered_pid zigzag45 无扰动](figures/4-7-controller-filtered_pid-zigzag45-calm.png)

![filtered_pid zigzag45 有扰动](figures/4-7-controller-filtered_pid-zigzag45-disturbed.png)

![filtered_pid turning_ramp 无扰动](figures/4-7-controller-filtered_pid-turning_ramp-calm.png)

![filtered_pid turning_ramp 有扰动](figures/4-7-controller-filtered_pid-turning_ramp-disturbed.png)

### disturbance_optimized

![disturbance_optimized zigzag45 无扰动](figures/4-7-controller-disturbance_optimized-zigzag45-calm.png)

![disturbance_optimized zigzag45 有扰动](figures/4-7-controller-disturbance_optimized-zigzag45-disturbed.png)

![disturbance_optimized turning_ramp 无扰动](figures/4-7-controller-disturbance_optimized-turning_ramp-calm.png)

![disturbance_optimized turning_ramp 有扰动](figures/4-7-controller-disturbance_optimized-turning_ramp-disturbed.png)


## 供讲义回写的判断

1. 可以把辨识步骤写成“舵机阶跃辨识 -> 船体艏摇阶跃辨识 -> 扰动等效惯性辨识 -> 三阶航向模型组合验证”。
2. 控制器设计仍沿用讲义主线，但结果必须同时放到辨识模型和高保真模型上比较，并在航向角图中同时显示给定信号。
3. 高保真模型中外部扰动接口已经具备，讲义中应把扰动下偏差解释为低阶辨识模型的适用边界，而不是把它处理成异常现象。

讲义正文只选取 zig-zag 航线和回转运动的代表图，其余图作为报告附证保留。
