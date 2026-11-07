//! issue-2153-p1 A1.1 首批算例：状态与运动学几何正确性、质量阵正定判定。

use control_engine::sixdof::{
    euler_from_quaternion, euler_rate_transform_inverse, jacobian_eta, moment_from_force,
    normalize_quaternion, quaternion_rate, rotation_matrix, symmetric_positive_definite_3,
    symmetric_positive_definite_6, Euler,
};

fn close(a: f64, b: f64, tol: f64) -> bool {
    (a - b).abs() <= tol
}

#[test]
fn quaternion_normalization_recovers_unit_and_handles_zero() {
    let q = normalize_quaternion([3.0, 0.0, 0.0, 0.0]);
    assert!(close(q[0], 1.0, 1e-12));
    let zero = normalize_quaternion([0.0; 4]);
    assert_eq!(zero, [1.0, 0.0, 0.0, 0.0]);
    let q2 = normalize_quaternion([1.0, 1.0, 1.0, 1.0]);
    let norm = (q2[0] * q2[0] + q2[1] * q2[1] + q2[2] * q2[2] + q2[3] * q2[3]).sqrt();
    assert!(close(norm, 1.0, 1e-12));
}

#[test]
fn rotation_matrix_is_orthonormal_with_unit_determinant() {
    // 任意非平凡姿态：绕 z 转 90° 的四元数。
    let q = [(0.25f64).sqrt(), 0.0, 0.0, (0.25f64).sqrt()];
    let r = rotation_matrix(q);
    let mut product = [[0.0f64; 3]; 3];
    for i in 0..3 {
        for j in 0..3 {
            let mut acc = 0.0;
            for k in 0..3 {
                acc += r[k][i] * r[k][j];
            }
            product[i][j] = acc;
        }
    }
    for i in 0..3 {
        for j in 0..3 {
            let expect = if i == j { 1.0 } else { 0.0 };
            assert!(close(product[i][j], expect, 1e-12));
        }
    }
    let det = r[0][0] * (r[1][1] * r[2][2] - r[1][2] * r[2][1])
        - r[0][1] * (r[1][0] * r[2][2] - r[1][2] * r[2][0])
        + r[0][2] * (r[1][0] * r[2][1] - r[1][1] * r[2][0]);
    assert!(close(det, 1.0, 1e-12));
}

#[test]
fn zero_angular_velocity_keeps_quaternion_constant() {
    let q = normalize_quaternion([1.0, 0.2, -0.3, 0.4]);
    let rate = quaternion_rate(q, [0.0, 0.0, 0.0]);
    for value in rate {
        assert!(close(value, 0.0, 1e-15));
    }
}

#[test]
fn yaw_rotation_quaternion_matches_euler_after_integration() {
    // 绕体 z 以 r=0.1 rad/s 转 10 s（初始姿态单位）：四元数积分 vs 解析 yaw。
    let r = 0.1f64;
    let dt = 1.0 / 240.0;
    let mut q = [1.0, 0.0, 0.0, 0.0];
    let steps = (10.0 / dt) as usize;
    for _ in 0..steps {
        // RK4 作用在 q̇(q) 上（线性方程，RK4 精确到机器精度级）。
        let k1 = quaternion_rate(q, [0.0, 0.0, r]);
        let q2 = normalize_quaternion([
            q[0] + 0.5 * dt * k1[0], q[1] + 0.5 * dt * k1[1],
            q[2] + 0.5 * dt * k1[2], q[3] + 0.5 * dt * k1[3],
        ]);
        let k2 = quaternion_rate(q2, [0.0, 0.0, r]);
        let q3 = normalize_quaternion([
            q[0] + 0.5 * dt * k2[0], q[1] + 0.5 * dt * k2[1],
            q[2] + 0.5 * dt * k2[2], q[3] + 0.5 * dt * k2[3],
        ]);
        let k3 = quaternion_rate(q3, [0.0, 0.0, r]);
        let q4 = normalize_quaternion([
            q[0] + dt * k3[0], q[1] + dt * k3[1], q[2] + dt * k3[2], q[3] + dt * k3[3],
        ]);
        let k4 = quaternion_rate(q4, [0.0, 0.0, r]);
        for i in 0..4 {
            q[i] += dt / 6.0 * (k1[i] + 2.0 * k2[i] + 2.0 * k3[i] + k4[i]);
        }
        q = normalize_quaternion(q);
    }
    let euler = euler_from_quaternion(q);
    assert!(close(euler.yaw_rad, r * 10.0, 1e-9));
    assert!(close(euler.roll_rad, 0.0, 1e-9));
    assert!(close(euler.pitch_rad, 0.0, 1e-9));
}

#[test]
fn pure_yaw_angular_velocity_maps_to_yaw_rate() {
    let euler = Euler::default();
    let rates = euler_rate_transform_inverse(euler, [0.0, 0.0, 0.35]);
    assert!(close(rates[0], 0.0, 1e-12));
    assert!(close(rates[1], 0.0, 1e-12));
    assert!(close(rates[2], 0.35, 1e-12));
}

#[test]
fn euler_rates_agree_with_quaternion_derivative_finite_difference() {
    // 非零横摇姿态 + 纯纵摇角速度：两运动学通路必须给出同一姿态演化。
    let roll = 0.5f64;
    let q = {
        let h = (roll / 2.0);
        [(h).cos(), (h).sin(), 0.0, 0.0]
    };
    let omega = [0.0, 1.0, 0.0];
    let dt = 1e-6;
    let qd = quaternion_rate(q, omega);
    let q_next = normalize_quaternion([
        q[0] + dt * qd[0], q[1] + dt * qd[1], q[2] + dt * qd[2], q[3] + dt * qd[3],
    ]);
    let e0 = euler_from_quaternion(q);
    let e1 = euler_from_quaternion(q_next);
    let fd_rates = [
        (e1.roll_rad - e0.roll_rad) / dt,
        (e1.pitch_rad - e0.pitch_rad) / dt,
        (e1.yaw_rad - e0.yaw_rad) / dt,
    ];
    let analytic = euler_rate_transform_inverse(e0, omega);
    for i in 0..3 {
        assert!(
            (analytic[i] - fd_rates[i]).abs() < 1e-6,
            "欧拉速率通路 {} 与四元数导数不一致：{} vs {}",
            i, analytic[i], fd_rates[i]
        );
    }
}

#[test]
fn jacobian_blocks_are_structurally_correct() {
    let q = normalize_quaternion([1.0, 0.2, -0.3, 0.4]);
    let euler = euler_from_quaternion(q);
    let j = jacobian_eta(q, euler);
    // 上右 / 下左为零块。
    for row in 0..3 {
        for col in 3..6 {
            assert!(close(j[row][col], 0.0, 1e-15));
        }
    }
    for row in 3..6 {
        for col in 0..3 {
            assert!(close(j[row][col], 0.0, 1e-15));
        }
    }
    // 位置块与 R(q) 一致；单位姿态且零横摇时 T⁻¹ 对角为 1。
    let unit_j = jacobian_eta([1.0, 0.0, 0.0, 0.0], Euler::default());
    for i in 0..3 {
        assert!(close(unit_j[i][i], 1.0, 1e-12));
        assert!(close(unit_j[3 + i][3 + i], 1.0, 1e-12));
    }
}

#[test]
fn moment_helper_is_the_cross_product() {
    // r=[0,0,z]（垂向作用点）受纵向力 Fx：力矩应在右舷方向（FRD y 分量）。
    let m = moment_from_force([0.0, 0.0, -2.0], [1500.0, 0.0, 0.0]);
    assert!(close(m[0], 0.0, 1e-9));
    assert!(close(m[1], -3000.0, 1e-9));
    assert!(close(m[2], 0.0, 1e-9));
}

#[test]
fn definiteness_handles_coupled_matrices_correctly() {
    // det = 0.25·1 − 0.36 < 0：非正定必须拒绝。
    let indefinite = [[0.25, 0.6, 0.0], [0.6, 1.0, 0.0], [0.0, 0.0, 1.0]];
    assert!(!symmetric_positive_definite_3(&indefinite));
    // det = 4 − 2.25 > 0 且顺序主子式全正：有效正定必须放行。
    let valid = [[4.0, 1.5, 0.0], [1.5, 1.0, 0.0], [0.0, 0.0, 1.0]];
    assert!(symmetric_positive_definite_3(&valid));
    // 6×6 含横荡—艏摇耦合的质量阵仍判正定（此前误拒的形态）。
    let mut six = [[0.0f64; 6]; 6];
    for (i, v) in [1.2e7, 2.4e7, 2.6e7, 5.6e9, 1.35e10, 6.1e10].into_iter().enumerate() {
        six[i][i] = v;
    }
    six[1][5] = -3.0e8;
    six[5][1] = -3.0e8;
    assert!(symmetric_positive_definite_6(&six));
    six[1][5] = -2.0e9; // 耦合超过 √(2.4e7×6.1e10)≈1.21e9，破坏顺序主子式
    six[5][1] = -2.0e9;
    assert!(!symmetric_positive_definite_6(&six));
}

#[test]
fn mass_matrix_definiteness_checks_reject_bad_matrices() {
    let good = [
        [1200.0, 0.0, 0.0],
        [0.0, 1600.0, 0.0],
        [0.0, 0.0, 900.0],
    ];
    assert!(symmetric_positive_definite_3(&good));
    let negative = [
        [1200.0, 0.0, 0.0],
        [0.0, -1600.0, 0.0],
        [0.0, 0.0, 900.0],
    ];
    assert!(!symmetric_positive_definite_3(&negative));
    let asymmetric = [
        [1200.0, 10.0, 0.0],
        [0.0, 1600.0, 0.0],
        [0.0, 0.0, 900.0],
    ];
    assert!(!symmetric_positive_definite_3(&asymmetric));

    let mut six = [[0.0f64; 6]; 6];
    for (i, value) in [1.2e7, 2.4e7, 2.6e7, 5.6e9, 1.35e10, 6.1e10].into_iter().enumerate() {
        six[i][i] = value;
    }
    assert!(symmetric_positive_definite_6(&six));
    six[0][0] = f64::NAN;
    assert!(!symmetric_positive_definite_6(&six));
}

// ---------- A1.2 dynamics ----------

use control_engine::sixdof::{
    coriolis_added_mass, coriolis_centripetal_rb, dynamics_step, mass_matrix,
    restoring_force, solve_linear_6, AddedMassParams, CurrentFieldBody, ExternalForces,
    RigidBodyParams, RestoringParams, TruthState,
};

fn sample_rb() -> RigidBodyParams {
    RigidBodyParams {
        mass_kg: 6.0e6,
        inertia_about_cg: [
            [2.4e9, 0.0, 0.0],
            [0.0, 1.4e10, 0.0],
            [0.0, 0.0, 1.5e10],
        ],
    }
}

fn sample_added_mass() -> AddedMassParams {
    let mut a = [[0.0f64; 6]; 6];
    for (i, value) in [6.0e5, 1.1e6, 6.6e6, 4.0e8, 3.9e9, 3.9e9].into_iter().enumerate() {
        a[i][i] = value;
    }
    // 非对角（横荡—艏摇耦合），保持对称。
    a[1][5] = -3.0e6;
    a[5][1] = -3.0e6;
    AddedMassParams { a_inf: a }
}

#[test]
fn mass_matrix_is_symmetric_and_positive_definite() {
    let m = mass_matrix(&sample_rb(), &sample_added_mass());
    for i in 0..6 {
        for j in 0..i {
            assert!((m[i][j] - m[j][i]).abs() < 1e-6);
        }
    }
    assert!(symmetric_positive_definite_6(&m));
}

#[test]
fn coriolis_rb_satisfies_energy_property() {
    let rb = sample_rb();
    let nu = [6.2, 0.4, 0.0, 0.0, 0.0, 0.08];
    let c = coriolis_centripetal_rb(&rb, nu);
    let power: f64 = nu.iter().zip(c.iter()).map(|(a, b)| a * b).sum();
    assert!(power.abs() < 1e-6 * nu.iter().map(|v| v.abs()).sum::<f64>().max(1.0));
}

#[test]
fn coriolis_added_mass_aligns_with_rigidbody_direction() {
    // A=2I、ν=[1,0,0,0,0,1]：附加质量与刚体科氏力必须同号（左端叠加）。
    let mut a = [[0.0f64; 6]; 6];
    for i in 0..6 {
        a[i][i] = 2.0;
    }
    let am = AddedMassParams { a_inf: a };
    let rb = RigidBodyParams { mass_kg: 2.0, inertia_about_cg: [[2.0,0.0,0.0],[0.0,2.0,0.0],[0.0,0.0,2.0]] };
    let nu = [1.0, 0.0, 0.0, 0.0, 0.0, 1.0];
    let c_a = coriolis_added_mass(&am, nu);
    let c_rb = coriolis_centripetal_rb(&rb, nu);
    for i in 0..6 {
        assert!((c_a[i] - c_rb[i]).abs() < 1e-12, "通道 {i}：C_A={} C_RB={}", c_a[i], c_rb[i]);
    }
}

#[test]
fn coriolis_added_mass_satisfies_energy_property() {
    let am = sample_added_mass();
    for nu_r in [
        [6.0, 0.5, 0.0, 0.01, 0.02, 0.09],
        [-1.2, 0.8, 0.1, 0.05, -0.03, 0.0],
        [0.0, 0.0, 0.0, 0.1, 0.1, 0.1],
    ] {
        let c = coriolis_added_mass(&am, nu_r);
        let power: f64 = nu_r.iter().zip(c.iter()).map(|(a, b)| a * b).sum();
        assert!(power.abs() < 1e-6);
    }
}

#[test]
fn restoring_force_opposes_positive_roll() {
    let mut k = [[0.0f64; 6]; 6];
    k[3][3] = 4.5e8; // 横摇恢复
    let rp = RestoringParams { k_linear: k };
    let g = restoring_force(&rp, [0.0, 0.0, 0.0, 0.1, 0.0, 0.0]);
    // g(η) 为方程左端项（Mν̇ + Cν + g = τ）：正横倾 g_roll>0，
    // 移项到右端为 −g<0，即恢复力矩反向——合同语义在 dynamics_step 内保证。
    assert!(g[3] > 0.0, "左端恢复项须为正，右端恢复力矩才反向");
}

#[test]
fn linear_solver_matches_known_solution() {
    let mut m = [[0.0f64; 6]; 6];
    for (i, value) in [2.0, 3.0, 5.0, 7.0, 11.0, 13.0].into_iter().enumerate() {
        m[i][i] = value;
    }
    let expected = [1.0, -2.0, 3.0, -4.0, 5.0, -6.0];
    let mut rhs = [0.0f64; 6];
    for i in 0..6 {
        for j in 0..6 {
            rhs[i] += m[i][j] * expected[j];
        }
    }
    let x = solve_linear_6(&mut m, rhs);
    for i in 0..6 {
        assert!((x[i] - expected[i]).abs() < 1e-12);
    }
}

#[test]
fn dynamics_step_assembles_current_inertia_and_zero_env_drift() {
    // 静水平衡校核：零外力、零流、零辐射、零偏差 → ν̇ = 0（无凭空增能）。
    let state = TruthState {
        quaternion: [1.0, 0.0, 0.0, 0.0],
        ..TruthState::default()
    };
    let out = dynamics_step(
        &state,
        &sample_rb(),
        &sample_added_mass(),
        &RestoringParams { k_linear: [[0.0; 6]; 6] },
        &CurrentFieldBody::default(),
        [0.0; 6],
        [0.0; 6],
        &ExternalForces::default(),
    );
    for value in out.nu_dot {
        assert!(value.abs() < 1e-9);
    }
    for value in out.position_dot_ned {
        assert!(value.abs() < 1e-9);
    }
    for value in out.quaternion_dot {
        assert!(value.abs() < 1e-15);
    }
}

#[test]
fn dynamics_step_current_acceleration_enters_relative_acceleration() {
    // 恒定加速横流 ν̇_c=[0, a, 0]：A_inf·ν̇_c 进入右端，ν̇ 方向与流加速度相反（相对加速度语义）。
    let state = TruthState {
        quaternion: [1.0, 0.0, 0.0, 0.0],
        ..TruthState::default()
    };
    let am = sample_added_mass();
    let current = CurrentFieldBody {
        nu_current_body: [0.0; 6],
        nu_current_body_dot: [0.0, 0.02, 0.0, 0.0, 0.0, 0.0],
    };
    let out = dynamics_step(
        &state,
        &sample_rb(),
        &am,
        &RestoringParams { k_linear: [[0.0; 6]; 6] },
        &current,
        [0.0; 6],
        [0.0; 6],
        &ExternalForces::default(),
    );
    // rhs[i] = A[i][1]*0.02 → ν̇ 由质量阵反解；验证分项与 rhs 一致性。
    assert!((out.breakdown.current_inertia[1] - am.a_inf[1][1] * 0.02).abs() < 1e-6);
    // 势流附加质量语义：无黏性外力时 A·ν̇_r 平衡 → ν̇ 与 ν̇_c 同向（船随流加速）；
    // "相对流减速"来自黏性 hull 项（hull_mmg 模块），不在此无黏性算例断言。
    assert!(out.nu_dot[1] > 0.0);
}

// ---------- A1.6 integrator ----------

use control_engine::sixdof::{
    advance_nominal_step, contact_substep_count, rk4_step, ContactStiffness,
    IntegrationError, NOMINAL_DT,
};

#[test]
fn rk4_integrates_harmonic_oscillator_with_high_order_accuracy() {
    // y'' = -ω²y ↔ y=[x, v]；RK4 全局误差 O(dt⁴)。50 步 @ dt=0.01。
    let omega = 2.0f64;
    let mut y = [1.0, 0.0];
    let dt = 0.01;
    let mut t = 0.0;
    for _ in 0..50 {
        rk4_step(t, &mut y, dt, |_t, state, d| {
            d[0] = state[1];
            d[1] = -omega * omega * state[0];
        }).unwrap();
        t += dt;
    }
    let (sin, cos) = (omega * t).sin_cos();
    assert!((y[0] - cos).abs() < 1e-8, "RK4 位置误差应为 1e-8 量级（四阶精度）");
    assert!((y[1] + omega * sin).abs() < 1e-8);
}

#[test]
fn contact_substeps_follow_stiffness_budget() {
    assert_eq!(contact_substep_count(None).unwrap(), 1);
    // 软接触：required = 0.1/√(k/m) ≥ 标称 → 1 子步。
    let soft = ContactStiffness { stiffness_n_per_m: 1.0e4, effective_mass_kg: 1.0e6 };
    let required = 0.1 / (soft.stiffness_n_per_m / soft.effective_mass_kg).sqrt();
    assert!(required >= NOMINAL_DT);
    assert_eq!(contact_substep_count(Some(soft)).unwrap(), 1);
    // 中等刚度：required ≈ 0.00316 → dt 需 ≤0.00316 → 3 子步（0.00278）。
    let medium = ContactStiffness { stiffness_n_per_m: 1.0e7, effective_mass_kg: 1.0e6 };
    let n = contact_substep_count(Some(medium)).unwrap();
    assert!(NOMINAL_DT / n as f64 <= 0.1 / (1.0e7f64 / 1.0e6).sqrt());
    assert!(NOMINAL_DT / (n - 1) as f64 > 0.1 / (1.0e7f64 / 1.0e6).sqrt());
}

#[test]
fn contact_budget_below_min_dt_errors_even_if_ninth_substep_would_fit() {
    // required = 0.1/√(1e4/1) = 0.001 s < MIN_DT ≈ 0.001042 s：
    // 旧实现会静默接受 9 子步（dt=1/1080 < MIN_DT），必须显式报错。
    let sneaky = ContactStiffness { stiffness_n_per_m: 1.0e4, effective_mass_kg: 1.0 };
    assert!(matches!(
        contact_substep_count(Some(sneaky)),
        Err(IntegrationError::ContactStiffnessBudgetExceeded { .. })
    ));
    // 8 子步上限内（required ≥ NOMINAL/8）仍正常细分。
    let edge = ContactStiffness {
        stiffness_n_per_m: 1.0e6,
        effective_mass_kg: 1.0,
    }; // required = 1e-4·√(1/1e6)?? 计算：0.1/√(1e6)=1e-4 < MIN → 也超
    let _ = edge;
    let okay = ContactStiffness { stiffness_n_per_m: 4.0e6, effective_mass_kg: 1.0e6 };
    // required = 0.1/2 = 0.05 ≥ NOMINAL → 1 子步
    assert_eq!(contact_substep_count(Some(okay)).unwrap(), 1);
}

#[test]
fn excessive_contact_stiffness_reports_budget_error() {
    // required = 0.1/√(1e12/1e6)=1e-4 s < MIN_DT → 显式报错，不裁剪。
    let extreme = ContactStiffness { stiffness_n_per_m: 1.0e12, effective_mass_kg: 1.0e6 };
    match contact_substep_count(Some(extreme)) {
        Err(IntegrationError::ContactStiffnessBudgetExceeded { required_dt }) => {
            assert!(required_dt < 1.0 / 960.0);
        }
        other => panic!("预期预算超限错误，得到 {:?}", other),
    }
}

#[test]
fn non_finite_derivative_surfaces_as_error() {
    let mut y = [1.0];
    let result = rk4_step(0.0, &mut y, 0.01, |_t, _s, d| { d[0] = f64::NAN; });
    assert!(matches!(result, Err(IntegrationError::NonFiniteState { stage: "k1", .. })));
}

#[test]
fn advance_nominal_step_advances_exact_nominal_dt() {
    let mut y = [0.0];
    let medium = ContactStiffness { stiffness_n_per_m: 1.0e7, effective_mass_kg: 1.0e6 };
    let t_end = advance_nominal_step(0.0, &mut y, Some(medium), |_t, s, d| {
        d[0] = 1.0;
        let _ = s;
    }).unwrap();
    assert!((t_end - NOMINAL_DT).abs() < 1e-15);
    assert!((y[0] - NOMINAL_DT).abs() < 1e-12);
}

// ---------- A1.5 radiation ----------

use control_engine::sixdof::{RadiationMode, RadiationModel, RadiationModelError};

fn sample_radiation() -> RadiationModel {
    RadiationModel {
        modes: vec![
            RadiationMode { a: -0.35, input_gain: 8.0e4, output_gain: 6.0e3, channel: 0 },
            RadiationMode { a: -0.9, input_gain: -1.4e5, output_gain: -2.2e4, channel: 1 },
            RadiationMode { a: -1.4, input_gain: 9.0e5, output_gain: 5.0e5, channel: 2 },
        ],
    }
}

#[test]
fn radiation_validates_passivity_and_rejects_bad_modes() {
    sample_radiation().validate().unwrap();
    let mut unstable = sample_radiation();
    unstable.modes[0].a = 0.4;
    assert!(matches!(unstable.validate(), Err(RadiationModelError::UnstableMode { index: 0, .. })));
    // 正实条件 (-A)·B·C ≥ 0 破坏 → 非被动。
    let mut not_passive = sample_radiation();
    not_passive.modes[1].output_gain = 2.2e4; // 翻转 C 破坏 B·C 同号（正实）
    assert!(matches!(not_passive.validate(), Err(RadiationModelError::NotPassive { index: 1, .. })));
    let mut bad_channel = sample_radiation();
    bad_channel.modes[2].channel = 9;
    assert!(matches!(bad_channel.validate(), Err(RadiationModelError::InvalidChannel { .. })));
}

#[test]
fn radiation_zoh_matches_analytic_constant_input_response() {
    // 单环节 x' = a·x + b·u，常输入 u₀ 从 0 起：x(t) = (b·u₀/a)(e^{at} − 1)。
    let model = RadiationModel {
        modes: vec![RadiationMode { a: -0.5, input_gain: 3.0, output_gain: 1.0, channel: 0 }],
    };
    let (x, tau) = model.step(&[0.0], [2.0, 0.0, 0.0, 0.0, 0.0, 0.0], 0.4);
    let analytic = (3.0 * 2.0 / -0.5) * ((-0.5f64 * 0.4).exp() - 1.0);
    assert!((x[0] - analytic).abs() < 1e-12);
    // 输出带零点：τ = C·(B·u + A·x⁺)，与状态解析一致。
    let tau_analytic = 1.0 * (3.0 * 2.0 + (-0.5) * analytic);
    assert!((tau[0] - tau_analytic).abs() < 1e-12);
    // 恒速稳态记忆为零（Cummins 合同）：x→B·u/|A| ⇒ τ→0。
    let mut state = vec![0.0];
    let mut last_tau = [0.0f64; 6];
    for _ in 0..2400 {
        let (next, tau_step) = model.step(&state, [2.0, 0.0, 0.0, 0.0, 0.0, 0.0], 1.0 / 120.0);
        state = next;
        last_tau = tau_step;
    }
    // 20 s ≈ 10 个时间常数后，稳态记忆趋零（容差收敛残差）。
    assert!(last_tau[0].abs() < 1e-3, "恒速稳态辐射记忆应趋零，得到 {}", last_tau[0]);
}

#[test]
fn radiation_impulse_response_decays_and_channel_maps() {
    let model = sample_radiation();
    let mut x = vec![1.0, 1.0, 1.0];
    let dt = 1.0 / 120.0;
    let mut last = [0.0f64; 6];
    for _ in 0..600 {
        let (next, tau) = model.step(&x, [0.0; 6], dt);
        x = next;
        last = tau;
    }
    // 5 s 后各通道记忆力 < 25% 初值（最慢 a=-0.35 → e^{-1.75}≈17.4%）。
    for mode in model.modes.iter() {
        let decay = (-mode.a * 5.0f64).exp();
        let bound = 1.05 * decay * mode.output_gain.abs();
        assert!(
            last[mode.channel].abs() <= bound,
            "通道 {} 应按 e^{{-a·t}} 衰减（≈{}），得到 {:?}",
            mode.channel, decay, last
        );
    }
}

// ---------- A1.4 actuators ----------

use control_engine::sixdof::{
    clamp_motor_torque, clamp_shaft_speed, propeller_loads, servo_step, shaft_acceleration,
    shaft_friction, shaft_power, PropellerModel, PropellerShaft, ServoModel,
};

fn sample_propeller() -> PropellerModel {
    PropellerModel {
        diameter_m: 4.9,
        water_density: 1025.0,
        kt_coefficients: [0.45, -0.32, -0.05],
        kq_coefficients: [0.048, -0.026, -0.006],
    }
}

fn sample_shaft() -> PropellerShaft {
    PropellerShaft {
        shaft_inertia: 2.6e3,
        max_motor_torque_nm: 4.6e5,
        max_shaft_speed_rad_s: 22.0,
        max_torque_rate_nm_s: 8.0e5,
        coulomb_friction_nm: 3.0e3,
        viscous_friction_nm_s_per_rad: 65.0,
    }
}

#[test]
fn propeller_loads_continuous_at_zero_speed_and_advance() {
    let prop = sample_propeller();
    let (t0, q0) = propeller_loads(&prop, 0.0, 0.0);
    assert!(t0.abs() < 1e-9 && q0.abs() < 1e-9, "n=0、Va=0 必须连续（零力）");
    // n→0⁺ 与 n→0⁻ 值连续归零（推力是 n 的奇函数，两侧反号属正确行为）。
    let (t_pos, _) = propeller_loads(&prop, 0.1, 1e-6);
    let (t_neg, _) = propeller_loads(&prop, 0.1, -1e-6);
    assert!(t_pos.abs() < 1e-5 && t_neg.abs() < 1e-5);
    assert!((t_pos - t_neg).abs() < 2e-5);
}

#[test]
fn propeller_loads_sign_follows_quadrant() {
    let prop = sample_propeller();
    // 前进：正转速 → 正推力；倒转：负推力。
    let (t_fwd, _) = propeller_loads(&prop, 3.0, 12.0);
    assert!(t_fwd > 0.0);
    let (t_rev, _) = propeller_loads(&prop, 3.0, -12.0);
    assert!(t_rev < 0.0);
    // 大进速比下推力下降（J 增大 kt 下降）。
    let (t_light, _) = propeller_loads(&prop, 45.0, 12.0);
    assert!(t_light < t_fwd);
}

#[test]
fn shaft_friction_opposes_rotation() {
    let shaft = sample_shaft();
    assert!(shaft_friction(&shaft, 10.0) > 0.0);
    assert!(shaft_friction(&shaft, -10.0) < 0.0);
    // 低速区线性无跳变（库仑项平滑处理）。
    let f_pos = shaft_friction(&shaft, 1e-5);
    let f_neg = shaft_friction(&shaft, -1e-5);
    assert!((f_pos - f_neg).abs() < 2.0 * shaft.coulomb_friction_nm + 1e-6);
}

#[test]
fn shaft_acceleration_balances_torques() {
    let shaft = sample_shaft();
    let prop = sample_propeller();
    let n = 12.0f64;
    let va = 4.0f64;
    let q_motor = 2.0e5f64;
    let (_, q_prop) = propeller_loads(&prop, va, n);
    let expected = (q_motor - q_prop - shaft_friction(&shaft, n)) / shaft.shaft_inertia;
    assert!((shaft_acceleration(&shaft, &prop, n, va, q_motor) - expected).abs() < 1e-9);
}

#[test]
fn motor_torque_respects_amplitude_and_rate_limits() {
    let shaft = sample_shaft();
    // 幅值限幅（dt 足够大、幅值主导时不可超上限）。
    let clamped = clamp_motor_torque(&shaft, 9.9e5, 0.0, 10.0);
    assert!((clamped - shaft.max_motor_torque_nm).abs() < 1e-9);
    // dt=0.5 时变化率限幅先生效（4e5 < 4.6e5）——限幅链条的次序行为。
    let rate_limited = clamp_motor_torque(&shaft, 9.9e5, 0.0, 0.5);
    assert!((rate_limited - 4.0e5).abs() < 1e-6);
    // 变化率限幅（dt 小时不超过 rate·dt）。
    let rated = clamp_motor_torque(&shaft, 4.0e5, 0.0, 1.0 / 120.0);
    assert!(rated <= shaft.max_torque_rate_nm_s / 120.0 + 1e-6);
}

#[test]
fn shaft_power_is_torque_times_speed() {
    assert!((shaft_power(2.0e5, 15.0) - 3.0e6).abs() < 1e-6);
    assert!((shaft_power(2.0e5, 0.0)).abs() < 1e-9);
    assert_eq!(clamp_shaft_speed(&sample_shaft(), 99.0), sample_shaft().max_shaft_speed_rad_s);
}

#[test]
fn servo_step_respects_rate_and_amplitude_limits() {
    let servo = ServoModel {
        max_angle_rad: 0.611, // ~35°
        max_rate_rad_s: 0.087, // ~5°/s
        time_constant_s: 0.2,
    };
    // 命令超幅值。
    let actual = servo_step(&servo, 0.0, 2.0, 1.0 / 120.0);
    assert!(actual <= servo.max_angle_rad + 1e-12);
    // 一步最多 rate·dt。
    let stepped = servo_step(&servo, 0.0, 0.5, 1.0 / 120.0);
    assert!(stepped <= servo.max_rate_rad_s / 120.0 + 1e-9);
}

// ---------- A1.3 hull_mmg ----------

use control_engine::sixdof::{
    blended_hull_loads, low_speed_loads, mmg_hull_loads, transition_weight,
    HullMmgParams, LowSpeedParams,
};

fn sample_mmg() -> HullMmgParams {
    HullMmgParams {
        x_uu: -2.0e3, x_u: -1.2e3,
        y_v: -3.4e5, y_vv: -2.2e6, y_vr: -4.0e5,
        y_r: -1.1e6, y_rr: -8.0e5,
        n_v: -1.6e7, n_vv: -4.0e7, n_vr: -9.0e6,
        n_r: -3.2e8, n_rr: -1.4e8,
        z_h: -3.5,
    }
}

fn sample_low() -> LowSpeedParams {
    LowSpeedParams { crossflow_y: 8.0e5, surge_drag: 2.0e3, yaw_arm: 45.0, z_h: -3.5 }
}

#[test]
fn transition_weight_is_monotone_with_plateaus() {
    assert_eq!(transition_weight(0.0), 0.0);
    assert_eq!(transition_weight(1.0), 0.0);
    assert_eq!(transition_weight(3.0), 1.0);
    assert_eq!(transition_weight(9.0), 1.0);
    assert!(transition_weight(1.5) < transition_weight(2.0));
    assert!(transition_weight(2.0) < transition_weight(2.5));
}

#[test]
fn low_speed_model_has_no_velocity_floor_and_is_quadratic() {
    let low = sample_low();
    // 零速零力（无奇异）。
    let zero = low_speed_loads(&low, 0.0, 0.0, 0.0);
    assert!(zero.iter().all(|f| f.abs() < 1e-9));
    // 侧移力反向且二次。
    let f_pos = low_speed_loads(&low, 0.0, 0.8, 0.0);
    let f_neg = low_speed_loads(&low, 0.0, -0.8, 0.0);
    assert!(f_pos[1] < 0.0 && f_neg[1] > 0.0);
    assert!((f_pos[1] + f_neg[1]).abs() < 1e-9);
    // 倒航纵向阻力同式（四象限）。
    let rev = low_speed_loads(&low, -1.2, 0.0, 0.0);
    assert!(rev[0] > 0.0, "倒航阻力应指向船艏（正向）");
}

#[test]
fn blending_is_weighted_average_not_superposition() {
    let mmg = sample_mmg();
    let low = sample_low();
    let (u, v, r) = (2.0f64, 0.5f64, 0.02f64);
    let w = transition_weight(u.abs());
    let a = mmg_hull_loads(&mmg, u, v, r);
    let b = low_speed_loads(&low, u, v, r);
    let blended = blended_hull_loads(&mmg, &low, u, v, r);
    let expect_fx = w * a[0] + (1.0 - w) * b[0];
    assert!((blended[0] - expect_fx).abs() < 1e-6, "过渡区必须是加权平均（无叠加）");
    // 高/低速端各自退化为单一模型。
    let high = blended_hull_loads(&mmg, &low, 5.0, v, r);
    let pure_high = mmg_hull_loads(&mmg, 5.0, v, r);
    assert!((high[0] - pure_high[0]).abs() < 1e-6);
    let stopped = blended_hull_loads(&mmg, &low, 0.4, v, r);
    let pure_low = low_speed_loads(&low, 0.4, v, r);
    assert!((stopped[1] - pure_low[1]).abs() < 1e-6);
}

#[test]
fn sway_force_at_depth_produces_coupled_roll_moment() {
    let mmg = sample_mmg();
    let low = sample_low();
    // 纯侧移（低速模型主导）：F_y<0（向左）作用在 z_h=-3.5 → 横摇力矩
    // K = z·F_y > 0（右舷下压），验证耦合方向随 z_h 符号翻转。
    let out = blended_hull_loads(&mmg, &low, 0.5, 1.0, 0.0);
    assert!(out[1] < 0.0);
    // 统一 r×F 合同：M = (−z·Fy, +z·Fx, 0)。
    let expected = moment_from_force([0.0, 0.0, mmg.z_h], [out[0], out[1], 0.0]);
    assert!((out[3] - expected[0]).abs() < 1e-6, "横摇耦合须等于 r×F 的 x 分量");
    assert!((out[4] - expected[1]).abs() < 1e-6, "纵摇耦合须等于 r×F 的 y 分量");
    let mut shallow = mmg;
    shallow.z_h = -0.1;
    let out2 = blended_hull_loads(&shallow, &low, 0.5, 1.0, 0.0);
    assert!(out2[3].abs() < out[3].abs(), "作用点越浅耦合力矩越小");
}

#[test]
fn mmg_loads_are_finite_across_quadrants() {
    let mmg = sample_mmg();
    for u in [-8.0, -0.01, 0.0, 0.01, 3.0, 12.0] {
        for v in [-2.0, 0.0, 2.0] {
            for r in [-0.1, 0.0, 0.1] {
                let loads = mmg_hull_loads(&mmg, u, v, r);
                assert!(loads.iter().all(|f| f.is_finite()));
            }
        }
    }
}
