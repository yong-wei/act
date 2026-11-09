//! 差频二阶 QTF（Newman 近似）算例（issue-2156 阶段 B2.1）。

use control_engine::sixdof::qtf::{MeanDriftTable, newman_difference_loads};
use control_engine::sixdof::{EnvironmentState, WaveCondition, SEED_TRAINING};

/// 暴力双重和（Newman 原式）——用于与 O(N) 复数和恒等对账。
fn bruteforce_newman(
    field: &control_engine::sixdof::WaveField,
    t: f64,
    x: f64,
    y: f64,
    yaw: f64,
    table: &MeanDriftTable,
) -> f64 {
    // 通过 public API 无法取分量内部——用 qtf 模块自身的恒等性测试覆盖：
    // 此处改为对 O(N) 结果做统计/均值性质验证（见各用例）。
    let _ = (field, t, x, y, yaw, table);
    0.0
}
// 暴力对账经分量访问在单元测试内完成（见下）。

#[test]
fn teaching_table_is_valid_and_positive() {
    let table = MeanDriftTable::teaching_nominal_semi_sub();
    table.validate().expect("T 级表应通过校验");
    assert!(table.surge.iter().all(|v| *v >= 0.0));
}

#[test]
fn second_order_off_is_strictly_zero_and_elevation_unchanged() {
    let mut env = EnvironmentState::e1(SEED_TRAINING);
    env.advance_to(20.0);
    // 未挂表 → 严格零（不伪造慢漂）。
    assert_eq!(env.second_order_wave_loads(20.0, 0.0, 0.0, 0.0), [0.0; 6]);
    let eta_before: Vec<f64> = (0..50)
        .map(|i| env.wave.elevation(i as f64 * 0.5, 12.0, -7.0))
        .collect();
    // 挂表后读取二阶。
    env.qtf_table = Some(MeanDriftTable::teaching_nominal_semi_sub());
    let loads = env.second_order_wave_loads(20.0, 0.0, 0.0, 0.0);
    assert!(loads[0] > 0.0, "顺浪分量应有正慢漂：{:?}", loads);
    // 波面序列不受二阶读取影响（同相可追踪、关二阶不改波面）。
    let eta_after: Vec<f64> = (0..50)
        .map(|i| env.wave.elevation(i as f64 * 0.5, 12.0, -7.0))
        .collect();
    assert_eq!(eta_before, eta_after);
    // 关波开关 → 二阶随关（与一阶同受 wave_enabled 约束）。
    env.switches.wave_enabled = false;
    assert_eq!(env.second_order_wave_loads(20.0, 0.0, 0.0, 0.0), [0.0; 6]);
}

#[test]
fn mean_matches_diagonal_convention() {
    // 表值约定：mean(F_c) = Σᵢ T_c(ωᵢ,μᵢ_rel)·aᵢ²（对角和）。
    // 航向对齐波传播方向 → surge 通道主导（方向投影 cos²≈1）。
    let mut env = EnvironmentState::new(
        SEED_TRAINING,
        control_engine::sixdof::EnvironmentSwitches::all_on(),
        WaveCondition::v1(),
        0.0, 0.0, 0.0,
        0.0, 0.0,
    );
    let table = MeanDriftTable::teaching_nominal_semi_sub();
    env.qtf_table = Some(table.clone());
    let yaw = WaveCondition::v1().direction_to_deg.to_radians();
    let analytic = control_engine::sixdof::qtf::newman_mean_loads(&env.wave, yaw, &table);
    assert!(analytic[0] > 1.0e2, "对角均值应达百牛量级：{:?}", analytic);

    let dt = 0.5_f64;
    let n = 7200usize; // 3600 s 长窗。
    let mut sum_fx = 0.0;
    for i in 0..n {
        let loads = env.second_order_wave_loads(i as f64 * dt, 0.0, 0.0, yaw);
        sum_fx += loads[0];
    }
    let time_mean = sum_fx / n as f64;
    assert!(
        (time_mean - analytic[0]).abs() / analytic[0] < 0.15,
        "时间平均应收敛到对角和：mean={time_mean}, analytic={}",
        analytic[0]
    );
}

#[test]
fn slow_drift_dominates_below_wave_frequency() {
    // 慢漂能量集中于差频低频段：载荷去均值后经 3×Tp（21s）盒式低通，
    // 滞回过零（±10% 标准差门限，抑制残余快纹波）测得的平均周期应
    // > 3×Tp——快波分量（周期 ~7s）不直接出现在二阶载荷里。
    let mut env = EnvironmentState::e1(SEED_TRAINING);
    env.qtf_table = Some(MeanDriftTable::teaching_nominal_semi_sub());
    let yaw = WaveCondition::v1().direction_to_deg.to_radians();
    let dt = 0.5_f64;
    let n = 8000usize; // 4000 s。
    let mut samples = Vec::with_capacity(n);
    let mut mean = 0.0;
    for i in 0..n {
        let loads = env.second_order_wave_loads(i as f64 * dt, 0.0, 0.0, yaw);
        samples.push(loads[0]);
        mean += loads[0];
    }
    mean /= n as f64;
    let centered: Vec<f64> = samples.iter().map(|s| s - mean).collect();
    let std = (centered.iter().map(|v| v * v).sum::<f64>() / n as f64).sqrt();
    // 21s 盒式低通。
    let win = 42usize;
    let low: Vec<f64> = (win / 2..n - win / 2)
        .map(|i| centered[i - win / 2..i + win / 2].iter().sum::<f64>() / win as f64)
        .collect();
    // 滞回过零：符号翻转须双侧幅值都超过 10% 标准差。
    let gate = 0.1 * std;
    let mut crossings = 0usize;
    let mut armed = low[0].signum();
    for &v in &low {
        if v >= gate && armed < 0.0 {
            crossings += 1;
            armed = 1.0;
        } else if v <= -gate && armed > 0.0 {
            crossings += 1;
            armed = -1.0;
        }
    }
    let window_s = (n - win) as f64 * dt;
    let mean_period_s = 2.0 * window_s / crossings.max(1) as f64;
    assert!(
        mean_period_s > 21.0,
        "慢漂平均周期应大于 3×Tp：{mean_period_s}s（crossings={crossings}）"
    );
}

#[test]
fn zero_table_gives_zero_and_direct_call_matches_env() {
    let mut env = EnvironmentState::e1(SEED_TRAINING);
    env.advance_to(10.0);
    // 直接调 qtf 入口（O(N) 复数和）。
    let table = MeanDriftTable::teaching_nominal_semi_sub();
    let direct = newman_difference_loads(&env.wave, 10.0, 5.0, -3.0, 0.2, &table);
    env.qtf_table = Some(table);
    let via_env = env.second_order_wave_loads(10.0, 5.0, -3.0, 0.2);
    for c in 0..6 {
        assert!((direct[c] - via_env[c]).abs() < 1e-9, "通道 {c} 应一致");
    }
    // 全零表（维度合法、值全零）→ 严格零载荷。
    let zero_table = MeanDriftTable {
        freqs_rad_s: vec![0.2, 2.5],
        dirs_rel_rad: vec![-1.5, 1.5],
        surge: vec![0.0; 4],
        sway: vec![0.0; 4],
        yaw: vec![0.0; 4],
        provenance: control_engine::sixdof::qtf::TableProvenance::TeachingNominal,
    };
    zero_table.validate().expect("全零表合法");
    assert_eq!(newman_difference_loads(&env.wave, 10.0, 0.0, 0.0, 0.0, &zero_table), [0.0; 6]);
    let _ = bruteforce_newman;
}
