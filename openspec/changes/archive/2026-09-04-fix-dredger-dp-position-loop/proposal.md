## Why

2026-09-04 QA 深测（Issue #1944，P1）发现 `/simulations/dredger`（天鲸号挖泥船）默认 DP 启动后定位误差持续增大（约 40.7s → 89.9 m、暂停时 118.5s → 302.2 m），界面持续显示「伦理违规」，且无功率字段。与 #1943（钻井平台）同轮发现但**不同根因**。

调查结论（2026-09-04）：
- **主因：DP 执行链路开环。** 控制器 `practice_dp_control`（Rust `practice_live.rs:257-338`）输出 `{rudderCommand, surgeThrust, swayThrust, yawMoment}` 四通道，但组件只取 `rudderCommand`（`dredger-simulation.tsx:788`），三个推力/力矩通道被整体丢弃；被控对象 `mmg3dof` 只接受舵角与螺旋桨转速，而转速被硬编码为 80 RPM 持续正推（约 245 kN，`:809-818`；遗留引擎 `engine-factory.ts:481,513` 同病）。位置环完全没有执行器，船匀速航离目标——QA 实测漂移 2.21 m/s 与「初速 2 m/s + 固定前进推力缓加速」数值精确吻合。
- **直接诱因：DP 定位任务初始状态自带 2 m/s 前进速度**（`createMMG3DOFState(0,0,0,2)`，`:704`；reset 同样，`:874`）。
- 放大/误导因素：风/流扰动滑杆是死控件（只进 UI 不进物理，`:515-551`）；`mmg3dof` 无横向（sway）执行器输入口（`virtual_simulation_runtime.rs:1383-1390`）；0.1 m 定位精度阈值被直接塞进 `EthicalViolation` 类型（`:792-804` 每步 push 一条，HUD 标签「伦理违规」语义失真）；功率字段缺失且因推力被丢弃而无数据源。现有测试只覆盖场景视觉 rollout，无 DP 定位收敛物理测试。
- 与 #1943 三因素（单位 ×1000、解耦矩阵、方位角启发式）均不作用——本页不用 `semisub3dof`/`practice_dp_decoupled_control`/`practice_allocate_thrust`。失败形态相反：#1943 是执行器权限过大立即饱和振荡，本页是执行器权限为零单调漂移。

## What Changes

- 接通 DP 执行链路，使位置环闭环（方案取舍见 design.md）：默认以 DP 输出驱动被控对象，surge 推力与推进器转速建立可逆映射（支持倒车），并解决 sway 执行器缺口——扩展 Rust `mmg3dof` 契约增加 surge/sway 推力输入，或为挖泥船换用带推进器配置的 plant 模型。
- DP 定位模式初始状态与 reset 的前进速度改为 0。
- 风向/流速/流向扰动滑杆接通物理与前馈；无法接通的扰动输入从 UI 移除，不做死控件。
- 从推进器推力派生并显示功率遥测（对齐钻井平台「总功率」口径）。
- 违规判定重构：定位精度告警与「伦理违规」语义解耦（精度超限应有持续时间滞回与正确文案，不每步重复计数）；HUD 标签改为定位精度告警语义。
- Rust 内核增加挖泥船 DP 定位收敛回归测试：默认参数、默认环境（含 500 kN 挖掘冲击场景）下，60 s 内位置误差收敛到 tolerance 量级；前端浏览器验收对齐 QA 复现路径。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `practice-live-control-engine`: DP 控制内核的全部输出通道必须映射到真实执行器并形成闭环，定位任务的默认初始状态不得自带漂移速度；收敛行为由回归测试锁定。

## Impact

- `src/resources/simulations/simulations/dredger-simulation.tsx`、`src/resources/simulations/core/engine-factory.ts`（执行链路、初始状态、扰动接通、功率、违规判定）。
- `rust/control-engine/`（`mmg3dof` 契约扩展或 plant 模型接入；涉及 WASM 重建）与 `rust/control-engine/tests/`（收敛回归）。
- `src/resources/simulations/profiles/dredger-tianjing.ts`（增益/容差按闭环复测校准）。
- 挖泥船页面浏览器验收。
- 显式非目标：不改 #1943 的钻井平台链路；不改其他船舶模型（lng/container/cruise 同轮正常）；不引入 TypeScript 物理 stepper（调度与 UI 仍在前端）。
