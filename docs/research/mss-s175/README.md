# S175 基准转录证据（issue-2157 阶段 B 路径 2）

## 来源（可追溯）

- 模型：`container.m` — MSS `CRAFT/SHIP/models/container.m`，
  Son & Nomoto (1982)《On the Coupled Motion of Steering and Rolling of a
  High Speed Container Ship》NA&OE 20:73-83（J.S.N.A. Japan Vol.150, 1981）。
- 驱动：`SIMcontainer.m` — 同仓库 `CRAFT/SHIP/SIMcontainer.m`（Fossen，
  2024-07-10 改 RK4）。
- 依赖：`mssConstants.m`（g=9.81、ρ=1025）、`rk4.m`、`ssa.m`。
- 上游修订：`e8ab42a105cd`（master，2026-11-08）。
  原始取回：2026-11-09，raw.githubusercontent.com 直取。

## 黄金轨迹生成

```bash
octave-cli generate_golden.m   # → golden_trajectory.csv（601 行 × [t,10 状态]）
```

设置与 `SIMcontainer.m` 一致：x0=[7,0,0,0,0,0,0,0,0,70]′、PD 航向控制
（Kp=1、Td=10、ψ_ref=5°、n_c=70 rpm）、RK4 h=0.1 s、600 s，每 1 s 采样。
容器模型历史修订语义保留（my=0.007049 为上游 2001-07-20 修订值）。

## Rust 移植对账

`rust/control-engine/src/sixdof/benchmark_s175.rs` 逐行移植；
`tests/sixdof_benchmark_s175.rs` 对 `tests/fixtures/s175_golden.csv`
逐通道逐点比对：**10 通道 600 s 最大偏差 ≤ 5×10⁻¹¹**（双精度舍入级，
见测试 stderr 输出），即移植与 Octave 源数值一致。

## 边界（issue 合同）

L=175m/B=25.4m/d=8.5m 等参数只属于基准，不映射到七船任一艘；源程序的
前进航速（U>0 断言）与转速（n>0 断言）限制不能冒充靠泊或倒航能力。
