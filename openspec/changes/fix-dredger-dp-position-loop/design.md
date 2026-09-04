# Design: 挖泥船 DP 执行链路接通方案

## 背景

`practice_dp_control` 输出四通道（rudder/surge/sway/yaw），`mmg3dof` 只接受两输入（rudderCommand/propellerRPM）。缺口有两层：surge 推力无入口（只有转速），sway 与 yaw 完全无执行器。

## 候选方案

### 方案 A：`mmg3dof` 契约增加可选推力输入

在 Rust `mmg3dof_step` 增加可选 `surgeThrustKN`/`swayThrustKN`/`yawMomentKNm` 输入（缺省 None 保持既有行为，向后兼容），推力直接并入 `mmg_forces`；组件把 DP 输出四通道原样传入。

- 优点：plant 模型与执行器解耦清晰；对其他 mmg3dof 消费者零影响；不新造模型。
- 缺点：改 Rust 契约需同步 WASM 与测试；天鲸号真实推进器布局（艏侧推等）需要以简化推力模型近似。

### 方案 B：surgeThrust → propellerRPM 可逆映射 + 换用带推进器的 plant

把 surge 推力按推力-转速平方关系映射回 RPM（支持负转速倒车），sway/yaw 缺口通过换用带推进器配置的 DP plant（如钻井平台的 `semisub3dof` + 推力分配）解决。

- 优点：不动 mmg3dof 契约。
- 缺点：换 plant 等于放弃 MMG（Manoeuvring Model Group）船体动力学——挖泥船的航行/操纵特性（舵效、裸船阻力曲线）与半潜平台差异大；映射回 RPM 引入平方反解的数值噪声。

### 方案 C：仅接通 surge（映射 RPM），sway 维持无执行器并放宽验收

- 优点：改动最小。
- 缺点：横向扰动（500 kN 挖掘冲击有横向分量时）仍不可控，定位收敛承诺不完整；本质是把 bug 修一半。

## 决策

**默认采用方案 A**：扩展 `mmg3dof` 可选推力输入最贴合「内核契约显式、plant 与执行器解耦」的现有架构方向，且向后兼容。实施时若发现 mmg3dof 内部结构不适配（如推力与螺旋桨力重复计入），回落到方案 B 并在 tasks 中记录原因。方案 C 拒绝。

## 违规判定语义

`EthicalViolation` 保留给真正的伦理/安全红线（如钻井平台紧急解脱）；定位精度超限改为独立的精度告警通道（持续超限 N 秒才触发一次，恢复后清除），HUD 标签不再显示「伦理违规」。该重构限定在挖泥船组件与共享的违规类型投影层，不动钻井平台紧急解脱语义。
