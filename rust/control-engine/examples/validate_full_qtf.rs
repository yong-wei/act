use std::time::Instant;

use control_engine::sixdof::full_qtf::{FullDifferenceQtf, QtfMeanCondition};
use control_engine::sixdof::wave::{WaveCondition, WaveField};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let arguments: Vec<_> = std::env::args().skip(1).collect();
    if arguments.len() != 3 {
        return Err("需要metadata.json、qtf-f32le.bin和报告输出路径".into());
    }
    let metadata = std::fs::read_to_string(&arguments[0])?;
    let bytes = std::fs::read(&arguments[1])?;
    let started = Instant::now();
    let table = FullDifferenceQtf::from_json_and_bytes(&metadata, &bytes)?;
    let load_ms = started.elapsed().as_secs_f64() * 1000.0;
    let field = WaveField::new(20261106, WaveCondition::v2());
    let started = Instant::now();
    let prepared = table.prepare(&field, 0.1, QtfMeanCondition {
        forward_speed_mps: 0.0, draft_m: 19.0, mesh_sha256: &table.metadata().mesh_sha256,
    })?;
    let prepare_ms = started.elapsed().as_secs_f64() * 1000.0;
    let started = Instant::now();
    let mut maximum_absolute = [0.0_f64; 6];
    let mut checksum = [0.0; 6];
    let mut trace = String::from("time_s,force_x_n,force_y_n,force_z_n,moment_x_nm,moment_y_nm,moment_z_nm\n");
    for tick in 0..120 {
        let time_s = tick as f64 / 120.0;
        let values = prepared.evaluate(time_s, 0.0, 0.0)?;
        trace.push_str(&format!("{time_s:.17e}"));
        for channel in 0..6 {
            maximum_absolute[channel] = maximum_absolute[channel].max(values[channel].abs());
            checksum[channel] += values[channel] * (tick + 1) as f64;
            trace.push_str(&format!(",{:.17e}", values[channel]));
        }
        trace.push('\n');
    }
    let elapsed_ms = started.elapsed().as_secs_f64() * 1000.0;
    let wave_path = std::path::Path::new(&arguments[2]).with_extension("wave.json");
    let trace_path = std::path::Path::new(&arguments[2]).with_extension("trace.csv");
    std::fs::write(&wave_path, serde_json::to_string(&field)? + "\n")?;
    std::fs::write(&trace_path, trace)?;
    let report = serde_json::json!({
        "schema": "act.full-qtf.native-validation.v1", "status": "passed",
        "data_content_hash": table.content_hash(), "data_bytes": bytes.len(),
        "source_declared_sha256": table.metadata().data_sha256,
        "model_fidelity": table.metadata().model_fidelity, "sample_only": table.metadata().sample_only,
        "source_frequency_count": table.metadata().frequencies_rad_s.len(),
        "source_heading_count": table.metadata().headings_rad_to.len(),
        "wave_components": field.component_count(), "seed": 20261106, "wave_condition": field.condition(),
        "mean_heading_rad": prepared.mean_heading_rad(), "load_ms": load_ms, "prepare_ms": prepare_ms,
        "wave_file": wave_path.file_name().unwrap().to_string_lossy(),
        "trace_file": trace_path.file_name().unwrap().to_string_lossy(),
        "evaluations": 120, "elapsed_ms": elapsed_ms, "mean_evaluation_ms": elapsed_ms / 120.0,
        "maximum_absolute_frd_si": maximum_absolute, "weighted_checksum": checksum,
        "platform": {"architecture": std::env::consts::ARCH, "os": std::env::consts::OS},
        "scope": "native release kernel, fixed mean heading; excludes WASM, vessel integration, rendering and network capacity"
    });
    std::fs::write(&arguments[2], serde_json::to_string_pretty(&report)? + "\n")?;
    println!("{}", report);
    Ok(())
}
