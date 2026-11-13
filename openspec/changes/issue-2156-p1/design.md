# Design: issue-2156-p1

## 模块（rust/control-engine/src/sixdof/）

- `wave.rs`：`WaveField { seed, hs_m, tp_s, direction_to_deg, water_depth_m }`。
  构建：128 等能频率段（JONSWAP γ3.3/σ 分段）×7 方向（主向±30°、10° 步、cos² 权重）；分量幅值再归一 Σa²/2=Hs²/16。
  求值：`elevation(t, x, y)`、`orbital_velocity(t, x, y, depth)`（线性波 Airy 轨道，色散 ω²=g·k·tanh(kh) 牛顿解）；一阶力接口 `first_order_loads(t)`（系数由船参数包给，缺省单位系数）；`second_order_available() = false`（QTF 阶段 B 显式 not_ready）。
  确定性：相位由 (频段序号, 方向序号, seed) 经 SplitMix64 派生，无全局时钟依赖。
- `wind.rs`：`TrueWind { speed_mean_mps, from_deg, gust }`；`GustProcess`（二维 OU，物理时钟 20Hz 步进、τ10s、SplitMix 子流）；`relative_wind(true_ned, nu_body, omega, lever_arm)`（NED→FRD、−船体运动−ω×r）；`fujiwara_loads(rel, frontal_area, lateral_area, …)`（CX/CY/CN/CK 的 T 级多项式近似，压力中心 K 经 r×F）；`wind_force_enabled` 消融开关语义（enabled+0 真风=相对气流；disabled=气动 0）。
- `sensor.rs`：`SensorChannel { rate_hz, white_sigma, bias_sigma, bias_tau, delay_s, quant }` 按表构造九通道；`sample(truth, t)` → 安装点量测（ω×r 补偿）、白噪（子流）、偏置 OU（精确离散 exp 形式）、量化、时延环形队列，输出 `Measurement { t_sample, t_arrive, value, quality }`；`NoiseLevel::{N0,N1,N2}`；`Fault::{HeadingBiasRamp, GnssOutage, ThrusterDriveCut, AzimuthFreeze}` 注入。
- plant 集成：`EnvironmentState { wind, wave, current_ned, wind_force_enabled, wave_enabled, current_enabled }` 替换 `EnvironmentField`（T 级等效保留为 `EnvironmentField::legacy_equivalent` 兼容旧测试），derivs 内风/波/流三通道独立进 `ExternalForces`（tau_wind/tau_wave_1）；runtime disturbance→E1（W1+V1+C1）。

## 种子

`SeedStreams::new(base_seed)` 派生子流：wave、gust、每传感器、每故障（SplitMix64 跳跃）；训练 20261106、验证 17/29/43 常量。关 N 噪声=对应子流不被消费（波面不变）。

## 验证

模块级单测（每模块算例见 tasks）+ plant 集成回归（E1 工况扰动现象保留）+ runtime 契约（disturbance 映射、EnvironmentState 往返）。
