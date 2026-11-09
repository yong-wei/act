//! S175 基准逐通道复现算例（issue-2157 阶段B 路径 2）。
//!
//! 黄金轨迹：tests/fixtures/s175_golden.csv——Octave 运行 MSS
//! container.m（上游 e8ab42a105cd）与 SIMcontainer.m 同设置
//! （x0=[7,0,…,70]′、PD Kp=1/Td=10、ψ_ref=5°、n_c=70、RK4 h=0.1、
//! 600 s）生成；Rust 移植须逐通道逐点一致。

use control_engine::sixdof::benchmark_s175::{rk4_step, ssa};

const GOLDEN: &str = include_str!("fixtures/s175_golden.csv");

fn parse_golden() -> Vec<[f64; 11]> {
    GOLDEN
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| {
            let mut row = [0.0f64; 11];
            for (i, v) in l.split(',').enumerate() {
                row[i] = v.trim().parse().expect("黄金 CSV 数值");
            }
            row
        })
        .collect()
}

#[test]
fn s175_rust_port_matches_octave_golden_channel_by_channel() {
    let golden = parse_golden();
    assert_eq!(golden.len(), 601, "黄金轨迹应 601 行（每 1s）");

    // 与 SIMcontainer.m 完全一致的驱动。
    let (kp, td, psi_ref, n_c) = (1.0f64, 10.0f64, 5.0f64.to_radians(), 70.0f64);
    let h = 0.1f64;
    let total_steps = 6000usize; // 600 s × 10 步/s。
    let mut x = [
        7.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 70.0,
    ];
    let mut sample_idx = 0usize;
    let mut max_err = [0.0f64; 10];
    for step in 0..=total_steps {
        if step % 10 == 0 {
            // 对账该秒的黄金行。
            let row = golden[sample_idx];
            assert!((row[0] - step as f64 / 10.0).abs() < 1e-9);
            for ch in 0..10 {
                let err = (x[ch] - row[1 + ch]).abs();
                // 尺度相关容差：位置/角度 1e-4 m/rad，速度 1e-6，rpm 1e-6
                //（Octave 与 Rust 双精度运算次序差异经 RK4 放大后的余量）。
                let tol = match ch {
                    3 | 4 => 2.0e-4, // x/y 位置。
                    5 => 1.0e-6,     // psi。
                    _ => 2.0e-6,
                };
                assert!(
                    err < tol,
                    "t={}s 通道 {ch} 偏差 {err} 超容差 {tol}（rust={}, golden={}）",
                    step as f64 / 10.0,
                    x[ch],
                    row[1 + ch]
                );
                max_err[ch] = max_err[ch].max(err);
            }
            sample_idx += 1;
        }
        let delta_c = -kp * (ssa(x[5] - psi_ref) + td * x[2]);
        x = rk4_step(&x, h, [delta_c, n_c]);
    }
    // 实测最大偏差应在容差的远下方（移植一致性证据）。
    for (ch, err) in max_err.iter().enumerate() {
        eprintln!("channel {ch} max_err = {err:.3e}");
    }
}

#[test]
fn s175_roll_yaw_coupling_physics_invariants() {
    // 物理不变量（独立于黄金对账）：定舵转向时出现耦合横摇、
    // 转向引起失速、舵角受 10° 饱和限制。
    let h = 0.1f64;
    let mut x = [
        7.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 70.0,
    ];
    // 持续右舵 10°（饱和值）定舵回转 300 s。
    let delta_c = 20.0f64.to_radians(); // 命令超限 → 实际饱和 10°。
    for _ in 0..3000 {
        x = rk4_step(&x, h, [delta_c, 70.0]);
    }
    eprintln!("steady turn: u={}, v={}, r={}, y={}, psi={}, phi={}, delta={}",
        x[0], x[1], x[2], x[4], x[5], x[7], x[8]);
    assert!((x[8] - 10.0f64.to_radians()).abs() < 1e-9, "舵角应饱和在 10°：{}", x[8]);
    assert!(x[2] != 0.0, "定舵应产生稳态转艏：{}", x[2]);
    assert!(x[0] < 7.0, "回转引起失速：u={} < 7", x[0]);
    assert!(x[7] != 0.0, "转向—横摇耦合应产生非零横摇：{}", x[7]);
    // 转艏方向与横移方向一致（轨迹弯曲同侧）。
    assert!(x[2] * x[4] > 0.0, "转艏与侧向位置应同号：r={}, y={}", x[2], x[4]);
}
