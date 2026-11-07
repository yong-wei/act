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
