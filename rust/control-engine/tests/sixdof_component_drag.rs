use control_engine::sixdof::component_drag::ComponentDragDefinition;
use control_engine::sixdof::model_pack::embedded_vessel_pack;
use control_engine::sixdof::DestroyerSixDofPlant;

fn definition() -> ComponentDragDefinition {
    ComponentDragDefinition { water_density_kg_m3: 1000.0, drag_coefficient: 1.0,
        stations_per_axis: 21, boxes_body_m: vec![[[-2.0, 2.0], [-1.0, 1.0], [-0.5, 0.5]]] }
}

#[test]
fn uniform_translation_matches_each_projected_area_and_force_center() {
    let mut definition = definition();
    definition.boxes_body_m[0] = [[-2.0, 2.0], [2.0, 4.0], [10.0, 11.0]];
    let model = definition.compile().unwrap();
    let values = model.loads(&[2.0, -3.0, 4.0, 0.0, 0.0, 0.0]);
    let expected = [-4000.0, 18000.0, -64000.0];
    for axis in 0..3 {
        assert!((values[axis] - expected[axis]).abs() < 1e-8);
    }
    assert!((values[3] - (3.0 * expected[2] - 10.5 * expected[1])).abs() < 1e-7);
    assert!((values[4] - 10.5 * expected[0]).abs() < 1e-7);
    assert!((values[5] + 3.0 * expected[0]).abs() < 1e-7);
}

#[test]
fn pure_rotation_converges_to_the_analytic_cube_integral() {
    let definition = definition();
    let coarse = definition.compile().unwrap().loads(&[0.0, 0.0, 0.0, 0.0, 0.0, 0.2]);
    let fine = ComponentDragDefinition { stations_per_axis: 42, ..definition }.compile().unwrap()
        .loads(&[0.0, 0.0, 0.0, 0.0, 0.0, 0.2]);
    // -ρ Cd H |r| r (L^4+B^4)/64。
    let expected = -170.0;
    assert!((coarse[5] - expected).abs() / expected.abs() < 0.005);
    assert!((fine[5] - expected).abs() / expected.abs() < 0.0012);
    assert!((fine[5] - expected).abs() < (coarse[5] - expected).abs());
    assert!(coarse[..3].iter().all(|value| value.abs() < 1e-10));
}

#[test]
fn six_dimensional_drag_is_dissipative_and_changes_sign_with_velocity() {
    let model = definition().compile().unwrap();
    for velocity in [[0.3, -0.4, 0.2, 0.1, -0.2, 0.05], [-1.0, 0.2, -0.3, 0.0, 0.2, -0.1]] {
        let loads = model.loads(&velocity);
        let power: f64 = loads.iter().zip(velocity).map(|(force, speed)| force * speed).sum();
        assert!(power < 0.0);
        let reversed = model.loads(&velocity.map(|value| -value));
        for axis in 0..6 {
            assert!((loads[axis] + reversed[axis]).abs() < 1e-10);
        }
    }
    assert_eq!(model.loads(&[0.0; 6]), [0.0; 6]);
}

#[test]
fn invalid_geometry_or_quadrature_is_rejected() {
    let mut changed = definition();
    changed.stations_per_axis = 0;
    assert!(changed.compile().is_err());
    changed = definition();
    changed.boxes_body_m[0][0] = [1.0, 1.0];
    assert!(changed.compile().is_err());
    changed = definition();
    changed.drag_coefficient = -1.0;
    assert!(changed.compile().is_err());
}

#[test]
fn semisub_real_rk_consumes_vertical_component_drag_and_preserves_saved_future() {
    let pack = embedded_vessel_pack("semisub-981", "research-nominal-v1").unwrap();
    let mut plant = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
    let mut state = plant.state().clone();
    state.body_velocity[2] = 0.2;
    plant.restore_state(state);
    let commands = control_engine::sixdof::actuator_system::ActuatorCommands {
        shafts: vec![Default::default(); 8], surfaces: vec![],
    };
    plant.step_with_actuators(1.0 / 120.0, &commands).unwrap();
    let vertical = plant.last_dynamics().unwrap().breakdown.external[2];
    let velocity = plant.state().body_velocity[2];
    let expected = -0.5 * 1025.0 * (2.0 * 110.0 * 17.0 + 4.0 * 20.0 * 20.0) * velocity * velocity;
    assert!((vertical - expected).abs() < 1e-6);
    assert!(vertical < 0.0);
    let checkpoint = plant.checkpoint();
    let mut restored = DestroyerSixDofPlant::from_model_pack(&pack, Default::default());
    restored.restore_checkpoint(checkpoint).unwrap();
    for _ in 0..60 {
        plant.step_with_actuators(1.0 / 120.0, &commands).unwrap();
        restored.step_with_actuators(1.0 / 120.0, &commands).unwrap();
    }
    assert_eq!(plant.state(), restored.state());
}
