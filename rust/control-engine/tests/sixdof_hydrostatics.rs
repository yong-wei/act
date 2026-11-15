use control_engine::sixdof::hydrostatics::HydrostaticHull;
use control_engine::sixdof::{integrator::NOMINAL_DT, TruthState};

const RHO: f64 = 1025.0;
const MASS: f64 = RHO * 80.0;

fn hull() -> HydrostaticHull {
    HydrostaticHull {
        vertices_body_m: vec![
            [-5.0, -2.0, -3.8],
            [5.0, -2.0, -3.8],
            [5.0, 2.0, -3.8],
            [-5.0, 2.0, -3.8],
            [-5.0, -2.0, 1.2],
            [5.0, -2.0, 1.2],
            [5.0, 2.0, 1.2],
            [-5.0, 2.0, 1.2],
        ],
        triangles: vec![
            [0, 3, 2],
            [0, 2, 1],
            [4, 5, 6],
            [4, 6, 7],
            [0, 4, 7],
            [0, 7, 3],
            [1, 2, 6],
            [1, 6, 5],
            [0, 1, 5],
            [0, 5, 4],
            [3, 7, 6],
            [3, 6, 2],
        ],
        cg_waterline_height_m: -0.8,
    }
}

fn state(heave: f64, roll: f64) -> TruthState {
    TruthState {
        position_ned: [0.0, 0.0, heave],
        quaternion: [(roll / 2.0).cos(), (roll / 2.0).sin(), 0.0, 0.0],
        ..Default::default()
    }
}

#[test]
fn box_displacement_heave_and_initial_stability_match_analytic_values() {
    let hull = hull();
    hull.validate().unwrap();
    let level = hull.evaluate(&state(0.0, 0.0), MASS, RHO);
    assert!((level.displaced_volume_m3 - 80.0).abs() < 1e-12);
    assert!(level.restoring_body.iter().all(|value| value.abs() < 1e-8));
    let down = hull.evaluate(&state(0.1, 0.0), MASS, RHO);
    assert!((down.displaced_volume_m3 - 84.0).abs() < 1e-12);
    assert!((down.restoring_body[2] - RHO * 9.81 * 40.0 * 0.1).abs() < 1e-8);
    let angle = 1e-5;
    let roll = hull.evaluate(&state(0.0, angle), MASS, RHO);
    let gm = 1.0 + 4.0_f64.powi(2) / (12.0 * 2.0) - 1.2;
    assert!((roll.restoring_body[3] / angle / (MASS * 9.81 * gm) - 1.0).abs() < 1e-7);
}

#[test]
fn finite_heel_buoyancy_and_moment_follow_the_clipped_prism_geometry() {
    let hull = hull();
    let angle = 30.0_f64.to_radians();
    let draft = 1.2 + 0.8 / angle.cos();
    let volume = 40.0 * draft;
    let cb_y = angle.tan() * 16.0 / (12.0 * draft);
    let cb_h = draft / 2.0 + angle.tan().powi(2) * 16.0 / (24.0 * draft);
    let actual = hull.evaluate(&state(0.0, angle), MASS, RHO);
    assert!((actual.displaced_volume_m3 - volume).abs() < 1e-12);
    let expected_roll = RHO * 9.81 * volume * (cb_y * angle.cos() - (1.2 - cb_h) * angle.sin());
    assert!((actual.restoring_body[3] - expected_roll).abs() < 1e-8);
    assert!((actual.restoring_body[1] - (RHO * volume - MASS) * 9.81 * angle.sin()).abs() < 1e-8);
}

#[test]
fn hydrostatic_force_is_the_gradient_of_the_same_potential_energy() {
    let hull = hull();
    let epsilon = 1e-5;
    let angle = 0.3;
    let actual = hull.evaluate(&state(0.2, angle), MASS, RHO);
    let roll_gradient = (hull
        .evaluate(&state(0.2, angle + epsilon), MASS, RHO)
        .potential_energy_j
        - hull
            .evaluate(&state(0.2, angle - epsilon), MASS, RHO)
            .potential_energy_j)
        / (2.0 * epsilon);
    assert!((roll_gradient - actual.restoring_body[3]).abs() < 1e-3);
    let heave_gradient = (hull
        .evaluate(&state(0.2 + epsilon, angle), MASS, RHO)
        .potential_energy_j
        - hull
            .evaluate(&state(0.2 - epsilon, angle), MASS, RHO)
            .potential_energy_j)
        / (2.0 * epsilon);
    let world_restoring =
        actual.restoring_body[1] * angle.sin() + actual.restoring_body[2] * angle.cos();
    assert!((heave_gradient - world_restoring).abs() < 1e-3);
}

#[test]
fn conservative_heave_oscillation_preserves_mechanical_energy() {
    let hull = hull();
    let mut values = [0.1, 0.0];
    let initial = hull
        .evaluate(&state(values[0], 0.0), MASS, RHO)
        .potential_energy_j;
    let mut largest_error = 0.0_f64;
    for _ in 0..60 * 120 {
        control_engine::sixdof::integrator::rk4_step(
            0.0,
            &mut values,
            NOMINAL_DT,
            |_, values, rates| {
                rates[0] = values[1];
                rates[1] = -hull
                    .evaluate(&state(values[0], 0.0), MASS, RHO)
                    .restoring_body[2]
                    / MASS;
            },
        )
        .unwrap();
        let energy = hull
            .evaluate(&state(values[0], 0.0), MASS, RHO)
            .potential_energy_j
            + 0.5 * MASS * values[1].powi(2);
        largest_error = largest_error.max((energy - initial).abs() / initial.abs());
    }
    assert!(largest_error < 1e-8, "保守静水能量误差 {largest_error}");
}

#[test]
fn dry_and_fully_submerged_bodies_keep_gravity_and_total_volume() {
    let hull = hull();
    let dry = hull.evaluate(&state(-10.0, 0.0), MASS, RHO);
    assert_eq!(dry.displaced_volume_m3, 0.0);
    assert_eq!(dry.restoring_body[2], -MASS * 9.81);
    let submerged = hull.evaluate(&state(10.0, 0.0), MASS, RHO);
    assert!((submerged.displaced_volume_m3 - 200.0).abs() < 1e-12);
    let mut open = hull.clone();
    open.triangles.pop();
    assert!(open.validate().is_err());
    let mut inward = hull;
    for face in &mut inward.triangles {
        face.reverse();
    }
    assert!(inward.validate().is_err());
}

#[test]
fn source_hull_equilibrium_and_small_angle_stiffness_match_the_same_geometry() {
    let pack = control_engine::sixdof::model_pack::embedded_destroyer_055_v4().unwrap();
    let geometry = &pack.geometry;
    let hull = geometry.nonlinear_hydrostatics.as_ref().unwrap();
    let equilibrium = hull.evaluate(&state(0.0, 0.0), geometry.displacement_mass_kg, RHO);
    assert!(
        (equilibrium.displaced_volume_m3 / geometry.displacement_volume_m3 - 1.0).abs() < 1e-12
    );
    assert!(equilibrium
        .restoring_body
        .iter()
        .all(|value| value.abs() < 1e-5));
    let stiffness = geometry.hydrostatic_stiffness_si.unwrap();
    let epsilon = 1e-5;
    for axis in 2..5 {
        let mut plus = state(0.0, 0.0);
        let mut minus = plus.clone();
        if axis == 2 {
            plus.position_ned[2] = epsilon;
            minus.position_ned[2] = -epsilon;
        } else {
            plus.quaternion[axis - 2] = (epsilon / 2.0).sin();
            plus.quaternion[0] = (epsilon / 2.0).cos();
            minus.quaternion[axis - 2] = -(epsilon / 2.0).sin();
            minus.quaternion[0] = (epsilon / 2.0).cos();
        }
        let upper = hull
            .evaluate(&plus, geometry.displacement_mass_kg, RHO)
            .restoring_body;
        let lower = hull
            .evaluate(&minus, geometry.displacement_mass_kg, RHO)
            .restoring_body;
        for row in 2..5 {
            let derivative = (upper[row] - lower[row]) / (2.0 * epsilon);
            let scale = (stiffness[row][row] * stiffness[axis][axis]).sqrt();
            assert!(
                (derivative - stiffness[row][axis]).abs() < scale * 0.005,
                "恢复矩阵({row},{axis}) 实际{derivative} 参考{}",
                stiffness[row][axis]
            );
        }
    }
}

#[test]
fn physical_plant_uses_nonlinear_restoring_at_each_integrated_pose() {
    use control_engine::sixdof::{DestroyerCommands, DestroyerSixDofPlant};
    let pack = control_engine::sixdof::model_pack::embedded_destroyer_055_v4().unwrap();
    let mut plant = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
    let mut initial = plant.state().clone();
    initial.position_ned[2] = 0.3;
    initial.quaternion = state(0.0, 15.0_f64.to_radians()).quaternion;
    plant.restore_state(initial);
    plant.step(DestroyerCommands::default()).unwrap();
    let expected = pack
        .geometry
        .nonlinear_hydrostatics
        .as_ref()
        .unwrap()
        .evaluate(plant.state(), pack.geometry.displacement_mass_kg, RHO)
        .restoring_body;
    assert_eq!(plant.last_dynamics().unwrap().breakdown.restoring, expected);
    let linear_roll = pack.geometry.hydrostatic_stiffness_si.unwrap()[3][3]
        * control_engine::sixdof::state::euler_from_quaternion(plant.state().quaternion).roll_rad;
    assert!((expected[3] / linear_roll - 1.0).abs() > 0.01);
}

#[test]
fn nonlinear_session_restoration_preserves_future_and_parameter_version() {
    use control_engine::sixdof::session::{FleetSimulation, SessionConfiguration};
    let mut original = FleetSimulation::new(SessionConfiguration {
        parameter_version: "research-nominal-v4".into(),
        noise_level: control_engine::sixdof::NoiseLevel::N0,
        ..Default::default()
    })
    .unwrap();
    original.advance(0.05, None).unwrap();
    let snapshot = original.snapshot_json().unwrap();
    let mut restored = FleetSimulation::from_snapshot_json(&snapshot).unwrap();
    original.advance(0.1, None).unwrap();
    restored.advance(0.1, None).unwrap();
    assert_eq!(
        original.snapshot_json().unwrap(),
        restored.snapshot_json().unwrap()
    );
    let mut invalid_geometry: serde_json::Value =
        serde_json::from_str(include_str!("../model-data/destroyer-055/v4/geometry.json")).unwrap();
    invalid_geometry["nonlinear_hydrostatics"]["cg_waterline_height_m"] = 10.0.into();
    let invalid = control_engine::sixdof::load_model_pack(
        include_str!("../model-data/destroyer-055/v4/manifest.json"),
        &invalid_geometry.to_string(),
        include_str!("../model-data/destroyer-055/v4/maneuvering.json"),
        include_str!("../model-data/destroyer-055/v4/actuators.json"),
        include_str!("../model-data/destroyer-055/v4/provenance.json"),
    );
    assert!(matches!(
        invalid,
        Err(control_engine::sixdof::PackError::InvalidHydrostaticHull { .. })
    ));
}
