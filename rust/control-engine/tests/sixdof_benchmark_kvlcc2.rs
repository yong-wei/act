//! KVLCC2常阻力模型基准。实尺度摩擦外推的验证状态单独记录。

use control_engine::sixdof::benchmark_kvlcc2::*;
use serde_json::json;

fn initial_state() -> [f64; 7] {
    [U0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
}

fn turning_indices(wp0: f64, delta_deg: f64, h: f64) -> (f64, f64) {
    let n = self_propulsion_rps_with(wp0, R0);
    let target = delta_deg.to_radians();
    let sign = target.signum();
    let mut state = initial_state();
    let mut advance = None;
    for _ in 0..(1200.0 / h) as usize {
        let next = rk4_step_with(&state, h, target, n, wp0, R0);
        for angle in [std::f64::consts::FRAC_PI_2, std::f64::consts::PI] {
            if sign * state[5] < angle && sign * next[5] >= angle {
                let fraction = (sign * angle - state[5]) / (next[5] - state[5]);
                if advance.is_none() {
                    advance = Some((state[3] + fraction * (next[3] - state[3])).abs() / LPP);
                } else {
                    let tactical = (state[4] + fraction * (next[4] - state[4])).abs() / LPP;
                    return (advance.unwrap(), tactical);
                }
            }
        }
        state = next;
    }
    panic!("回转未在1200秒内达到180度");
}

fn zigzag_overshoots(wp0: f64, rudder_deg: f64, h: f64) -> (f64, f64) {
    let n = self_propulsion_rps_with(wp0, R0);
    let angle = rudder_deg.to_radians();
    let mut state = initial_state();
    let mut command = angle;
    let mut phase = 0;
    let mut first = None;
    for _ in 0..(1200.0 / h) as usize {
        let next = rk4_step_with(&state, h, command, n, wp0, R0);
        if phase == 1 && state[2] > 0.0 && next[2] <= 0.0 {
            let fraction = state[2] / (state[2] - next[2]);
            first = Some((state[5] + fraction * (next[5] - state[5]) - angle).to_degrees());
        }
        if phase == 2 && state[2] < 0.0 && next[2] >= 0.0 {
            let fraction = state[2] / (state[2] - next[2]);
            let second = -(state[5] + fraction * (next[5] - state[5]) + angle).to_degrees();
            return (first.expect("应先完成第一超越角"), second);
        }
        if phase < 2 && command.signum() * next[5] >= angle {
            command = -command;
            phase += 1;
        }
        state = next;
    }
    panic!("Z形试验未在1200秒内完成第二超越角");
}

#[test]
fn self_propulsion_point_balances_effective_thrust_and_resistance() {
    for wp0 in [0.35, 0.40] {
        let n = self_propulsion_rps_with(wp0, R0);
        assert!(n > 1.0 && n < 2.5, "自航转速量级异常，{n} rps");
        let rate = derivative_with(&initial_state(), 0.0, n, wp0, R0);
        assert!(rate[0].abs() < 1e-12, "自航初态不平衡，uDot={}", rate[0]);
        let mut state = initial_state();
        for _ in 0..1200 {
            state = rk4_step_with(&state, 0.1, 0.0, n, wp0, R0);
        }
        assert!((state[0] - U0).abs() < 1e-9);
        assert!(state[1].abs() < 1e-12 && state[2].abs() < 1e-12);
    }
}

#[test]
fn l7_constant_resistance_turning_meets_reference_tolerance() {
    for (angle, reference) in [(35.0, (3.31, 3.36)), (-35.0, (3.26, 3.26))] {
        let measured = turning_indices(0.40, angle, 0.1);
        eprintln!("L7 {angle}: {measured:?}, paper={reference:?}");
        assert!((measured.0 - reference.0).abs() / reference.0 < 0.10);
        assert!((measured.1 - reference.1).abs() / reference.1 < 0.10);
    }
}

#[test]
fn l7_constant_resistance_zigzag_meets_absolute_osa_tolerance() {
    // Issue #2157要求超越角绝对差不超过5度。参考值来自原论文表5。
    let measured = zigzag_overshoots(0.40, 10.0, 0.1);
    eprintln!("L7 10/10: {measured:?}, paper second OSA=15.8");
    assert!((measured.1 - 15.8).abs() <= 5.0);
    assert!(measured.0 > 0.0);
}

#[test]
fn half_step_convergence_preserves_maneuver_metrics() {
    for wp0 in [0.35, 0.40] {
        let coarse = turning_indices(wp0, 35.0, 0.1);
        let fine = turning_indices(wp0, 35.0, 0.05);
        for (a, b) in [(coarse.0, fine.0), (coarse.1, fine.1)] {
            assert!((a - b).abs() / b.abs() < 0.01);
        }
        for angle in [10.0, 20.0] {
            let coarse = zigzag_overshoots(wp0, angle, 0.1);
            let fine = zigzag_overshoots(wp0, angle, 0.05);
            for (a, b) in [(coarse.0, fine.0), (coarse.1, fine.1)] {
                assert!((a - b).abs() / b.abs() < 0.01, "{angle}: {a} vs {b}");
            }
        }
    }
}

#[test]
fn steady_turn_loses_speed_with_consistent_direction() {
    let n = self_propulsion_rps();
    let mut state = initial_state();
    for _ in 0..6000 {
        state = rk4_step(&state, 0.1, 35.0_f64.to_radians(), n);
    }
    assert!(state.iter().all(|value| value.is_finite()));
    assert!(state[5] > std::f64::consts::PI);
    assert!(state[0] > 0.0 && state[0] < U0 * 0.6);
    assert!(state[2] > 0.0);
}

#[test]
fn export_reproducible_validation_report() {
    let l7_starboard = turning_indices(0.40, 35.0, 0.1);
    let l7_port = turning_indices(0.40, -35.0, 0.1);
    let full_starboard = turning_indices(0.35, 35.0, 0.1);
    let full_port = turning_indices(0.35, -35.0, 0.1);
    let full_zigzag = zigzag_overshoots(0.35, 10.0, 0.1);
    let report = json!({
        "schema": "act.kvlcc2.validation.v1",
        "source": "https://doi.org/10.1007/s00773-014-0293-y",
        "resistance_model": "constant R0=0.022 from L3 table 2",
        "time_step_s": 0.1,
        "self_propulsion": "(1-tP)*T=R",
        "l7": {
            "turning_starboard": {"measured": l7_starboard, "reference": [3.31,3.36]},
            "turning_port": {"measured": l7_port, "reference": [3.26,3.26]},
            "zigzag_10": {"measured": zigzag_overshoots(0.40,10.0,0.1), "reference_second_osa_deg": 15.8},
        },
        "full_scale": {
            "status": "not_ready",
            "missing": "Schoenherr three-dimensional resistance extrapolation inputs",
            "turning_starboard": {"measured": full_starboard, "reference": [3.62,3.71]},
            "turning_port": {"measured": full_port, "reference": [3.56,3.59]},
            "zigzag_10": {"measured": full_zigzag, "reference": [5.8,20.5]},
            "zigzag_20": {"measured": zigzag_overshoots(0.35,20.0,0.1), "reference_first_osa_deg": 11.8},
        },
    });
    if let Ok(path) = std::env::var("ACT_KVLCC2_REPORT_PATH") {
        std::fs::write(path, serde_json::to_string_pretty(&report).unwrap() + "\n").unwrap();
    }
    println!("{report}");
}
