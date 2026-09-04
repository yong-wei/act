## Why

2026-09-04 QA 巡检（Issue #1943，P1）发现 `/simulations/drilling`（海洋石油981钻井平台）默认控制运行约 24 秒即触发紧急解脱：位置误差 40.32 m、总功率 36.0 MW、8 台推进器全饱和、伦理违规计数停在 21。对照场景（052D 驱逐舰、雪龙2 破冰船）默认运行正常。

调查结论（2026-09-04）：
- **主因：推力单位双重 ×1000。** 调用方把推力分配结果按 kN→N 转换后传入 Rust `semisub3dof`（`drilling-simulation.tsx:978-982`、`engine-factory.ts:1783-1787`，注释「kN -> N」），但 Rust 契约本身按 kN 输入、在 `virtual_simulation_runtime.rs:1457-1459` 内部再乘 1000——推力被放大 1000 倍，闭环等效增益爆炸，速度立即打满 clamp（±2 m/s），24 s 漂移量级与 40.32 m 观测吻合；巨大误差使 tauCmd 全饱和 → 8×4500 kW 满功率 = 36.0 MW 吻合；每步超阈值 push 一条违规、截断 20 条 → 计数 21 吻合。旧 TS 模型时代即存在同一单位错误，Rust 化时被忠实复刻；现有 Rust 测试只断言 finite，未覆盖闭环收敛，故未拦截。
- **放大因素一：解耦矩阵量纲污染**（`practice_live_platform.rs:308-328`，decoupledTauY = 1.25·tauY − 125·tauN，kN·m 力矩与 kN 力直接相加）。
- **放大因素二：推力分配方位角启发式对大力矩过敏**（`Mz/1000·5°`，力矩被污染后方位角偏转可达数千度）。
- 次要：风环境更新把当前风速当均值传入（`drilling-simulation.tsx:925`），风干扰缓慢衰减。
- 初始状态与目标 setpoint 均已验证为 0，初始偏移/目标非零假设不成立；紧急解脱阈值 10 m 是钻柱安全设计值，无需放宽。

## What Changes

- 统一 `semisub3dof` 的推进力单位契约：修正调用侧（两处）或内核侧的单一定义，消除双重换算；契约以文档化注释与类型辅助固定，防止回归。
- 修正单位后复测解耦矩阵系数与推力分配方位角启发式在正确量纲下的行为，必要时按控制工程复核调整（H2/H3 为放大因素，单位修正后可能自然收敛，须以复测数据裁决）。
- 修正风环境均值传参。
- 在 Rust `control-engine` 增加 semisub3dof 闭环收敛回归测试：默认 DP 参数、默认海况（level 3）、零初始状态与零目标下，60 s 内位置误差收敛至安全范围（< 3 m），不触发紧急解脱阈值。
- 前端钻井平台页面在默认开局通过 60 s 收敛的浏览器验收（复用 QA 巡检路径）。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `practice-live-control-engine`: 平台 DP 控制内核的推力单位契约必须单一且被闭环收敛回归测试锁定，默认参数开局不得发散。

## Impact

- `src/resources/simulations/simulations/drilling-simulation.tsx`、`src/resources/simulations/core/engine-factory.ts`（调用侧单位）。
- `rust/control-engine/src/virtual_simulation_runtime.rs` 或 `practice_live_platform.rs`（契约统一与可能的系数复核；涉及 WASM 重建）。
- `rust/control-engine/tests/`（闭环收敛回归测试）。
- 钻井平台仿真验收（`wasm:build:control-engine` 后浏览器复测）。
- 显式非目标：不放宽紧急解脱阈值与伦理违规逻辑；不改其他船舶模型（destroyer/icebreaker 已正常）；不重写 DP 控制律结构。
