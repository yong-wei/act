use control_engine::sixdof::first_order_wave::FirstOrderExcitation;
use control_engine::sixdof::wave::{WaveCondition, WaveField};
use std::time::Instant;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let arguments: Vec<_> = std::env::args().skip(1).collect();
    if arguments.len() != 3 {
        return Err("需要metadata.json、excitation-f32le.bin和报告输出路径".into());
    }
    let metadata = std::fs::read_to_string(&arguments[0])?;
    let bytes = std::fs::read(&arguments[1])?;
    let table = FirstOrderExcitation::from_json_and_bytes(&metadata, &bytes)?;
    let field = WaveField::new(
        20261106,
        WaveCondition {
            water_depth_m: table.metadata().water_depth_m,
            ..WaveCondition::v2()
        },
    );
    let mean_heading = 0.13;
    let speed = table.metadata().forward_speeds_mps[0];
    let prepared = table.prepare(&field, mean_heading, speed)?;
    let mut trace = String::from(
        "time_s,north_m,east_m,force_x_n,force_y_n,force_z_n,moment_x_nm,moment_y_nm,moment_z_nm\n",
    );
    let started = Instant::now();
    for tick in 0..120 {
        let time_s = tick as f64 / 120.0;
        let north_m = 0.2 * time_s;
        let east_m = -0.1 * time_s;
        let loads = prepared.evaluate(time_s, north_m, east_m)?;
        trace.push_str(&format!("{time_s:.17e},{north_m:.17e},{east_m:.17e}"));
        for value in loads {
            trace.push_str(&format!(",{value:.17e}"));
        }
        trace.push('\n');
    }
    let elapsed_ms = started.elapsed().as_secs_f64() * 1000.0;
    let wave_path = std::path::Path::new(&arguments[2]).with_extension("wave.json");
    let trace_path = std::path::Path::new(&arguments[2]).with_extension("trace.csv");
    std::fs::write(&wave_path, serde_json::to_string(&field)? + "\n")?;
    std::fs::write(&trace_path, trace)?;
    let report = serde_json::json!({
        "schema": "act.first-order-wave.native-validation.v1", "status": "passed",
        "vessel": table.metadata().vessel, "model_fidelity": table.metadata().model_fidelity,
        "metadata_bytes_fnv1a64": table.metadata_bytes_hash(), "data_bytes": bytes.len(),
        "wave_components": field.component_count(), "seed": 20261106,
        "wave_condition": field.condition(), "mean_heading_rad": mean_heading, "mean_speed_mps": speed,
        "wave_file": wave_path.file_name().unwrap().to_string_lossy(),
        "trace_file": trace_path.file_name().unwrap().to_string_lossy(),
        "evaluations": 120, "elapsed_ms": elapsed_ms, "mean_evaluation_ms": elapsed_ms/120.0,
        "scope": "native release kernel with full wave components and actual spatial phase"
    });
    std::fs::write(&arguments[2], serde_json::to_string_pretty(&report)? + "\n")?;
    println!("{report}");
    Ok(())
}
