use control_engine::sixdof::NoiseLevel;
use control_engine::sixdof::control_law::HeadingControlMode;
use control_engine::sixdof::first_order_wave::FirstOrderExcitation;
use control_engine::sixdof::full_qtf::FullDifferenceQtf;
use control_engine::sixdof::model_pack::embedded_vessel_pack;
use control_engine::sixdof::semisub_allocator::AllocationMode;
use control_engine::sixdof::semisub_dp::{DpFeedback, NavigationLossStrategy, SemisubDpInput};
use control_engine::sixdof::session::{EnvironmentPreset, FleetSimulation, SessionConfiguration};
use control_engine::sixdof::vessel_wave::WaveModelAssets;
use control_engine::sixdof::wave::{WaveCondition, WaveField};
use serde_json::json;
use std::time::Instant;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let arguments: Vec<_> = std::env::args().skip(1).collect();
    if arguments.len() != 2 {
        return Err("需要公开波浪数据目录和报告输出路径".into());
    }
    let root = std::path::Path::new(&arguments[0]);
    let manifest: serde_json::Value = serde_json::from_str(include_str!(
        "../model-data/semisub-981/v5/wave-assets.json"
    ))?;
    let data = |name: &str| -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        Ok(std::fs::read(
            root.join(
                manifest[name]["data_sha256"]
                    .as_str()
                    .ok_or("缺少数据摘要")?,
            )
            .join(manifest[name]["data_file"].as_str().ok_or("缺少数据名称")?),
        )?)
    };
    let assets = WaveModelAssets {
        first_order: FirstOrderExcitation::from_json_and_bytes(
            include_str!("../model-data/semisub-981/v5/first-order-wave.json"),
            &data("first_order")?,
        )?,
        full_difference: Some(FullDifferenceQtf::from_json_and_bytes(
            include_str!("../model-data/semisub-981/v5/full-difference-wave.json"),
            &data("full_difference")?,
        )?),
    };
    let pack = embedded_vessel_pack("semisub-981", "research-nominal-v5")
        .map_err(|error| format!("{error:?}"))?;
    let binding = pack.geometry.wave_model.as_ref().ok_or("缺少波浪登记")?;
    let mut loads = Vec::new();
    for bins in [128, 16] {
        let field = WaveField::representative(20261106, WaveCondition::v2(), bins)?;
        let model = assets.compile("semisub-981", binding, &pack.geometry, &field, 0.0, true)?;
        let started = Instant::now();
        let mut first_squared = [0.0; 6];
        let mut second_squared = [0.0; 6];
        let mut second_sum = [0.0; 6];
        for time in 0..600 {
            let (first, second) = model.loads(time as f64, [0.0; 3], [1.0, 0.0, 0.0, 0.0])?;
            for axis in 0..6 {
                first_squared[axis] += first[axis] * first[axis];
                second_squared[axis] += second[axis] * second[axis];
                second_sum[axis] += second[axis];
            }
        }
        loads.push(json!({"frequencyBins":bins,"components":field.component_count(),"energy":field.energy_sum(),
            "firstRms":first_squared.map(|sum:f64|(sum/600.0).sqrt()),
            "secondRms":second_squared.map(|sum:f64|(sum/600.0).sqrt()),
            "secondMean":second_sum.map(|sum|sum/600.0),"loadEvaluations":600,"elapsedMs":started.elapsed().as_secs_f64()*1000.0}));
    }
    let mut records = Vec::new();
    for (drive_cut, gnss_outage) in [(false, false), (true, false), (false, true)] {
        let configuration = SessionConfiguration {
            vessel: "semisub-981".into(),
            parameter_version: "research-nominal-v5".into(),
            environment: EnvironmentPreset::E1,
            noise_level: NoiseLevel::N1,
            second_order_enabled: Some(true),
            wave_frequency_bins: Some(16),
            drive_cut_fault: drive_cut,
            gnss_outage_fault: gnss_outage,
            ..Default::default()
        };
        let mut simulation = FleetSimulation::with_wave_assets(configuration, assets.clone())?;
        let mut input = simulation.input().clone();
        input.control_mode = HeadingControlMode::Pid;
        input.semisub_dp = Some(SemisubDpInput {
            target_position_m: [0.0; 2],
            target_heading_deg: 0.0,
            bandwidth_rad_s: 0.025,
            integral_enabled: true,
            integral_time_s: 200.0,
            feedback: DpFeedback::LowFrequency,
            low_frequency_cutoff_hz: 0.04,
            decoupling: false,
            student_model: None,
            wind_feedforward: true,
            allocation: AllocationMode::SequentialConvex,
            axis_weights: [1.0; 3],
            energy_weight: 1.0,
            reallocate: true,
            navigation_loss_strategy: NavigationLossStrategy::FreezeIntegral,
        });
        simulation.advance(0.0, Some(input))?;
        let started = Instant::now();
        let mut position_squared = 0.0;
        let mut heading_squared = 0.0;
        let mut maximum_position = 0.0_f64;
        let mut peak_power = 0.0_f64;
        let mut peak_residual = 0.0_f64;
        let mut last180 = 0;
        for tick in 0..6000 {
            simulation.advance(0.1, None)?;
            if tick % 10 != 9 {
                continue;
            }
            let frame: serde_json::Value = serde_json::from_str(&simulation.frame_json()?)?;
            let north = frame["truth"]["position_ned"][0]
                .as_f64()
                .ok_or("缺少北向位置")?;
            let east = frame["truth"]["position_ned"][1]
                .as_f64()
                .ok_or("缺少东向位置")?;
            let heading = frame["attitudeDeg"]["heading"].as_f64().ok_or("缺少航向")?;
            peak_power = peak_power.max(
                frame["propulsionPower"]["positiveMechanicalPowerW"]
                    .as_f64()
                    .ok_or("缺少功率")?,
            );
            peak_residual = peak_residual.max(
                frame["dpController"]["allocation"]["normalizedResidual"]
                    .as_f64()
                    .unwrap_or(0.0),
            );
            if tick >= 4200 {
                position_squared += north * north + east * east;
                heading_squared += heading * heading;
                maximum_position = maximum_position.max(north.hypot(east));
                last180 += 1;
            }
        }
        let snapshot = simulation.snapshot_json()?;
        let mut restored = simulation.clone();
        restored.restore_snapshot(&snapshot)?;
        for _ in 0..10 {
            simulation.advance(0.1, None)?;
            restored.advance(0.1, None)?;
        }
        assert_eq!(simulation.snapshot_json()?, restored.snapshot_json()?);
        let position_rms = (position_squared / last180 as f64).sqrt();
        let heading_rms = (heading_squared / last180 as f64).sqrt();
        let record = json!({"driveCutT2":drive_cut,"gnssOutage":gnss_outage,"timeS":600,"frequencyBins":16,
            "positionRmsM":position_rms,"headingRmsDeg":heading_rms,"maximumPositionM":maximum_position,
            "peakPositiveMechanicalPowerW":peak_power,"peakNormalizedResidual":peak_residual,
            "restoredFutureIdentical":true,"elapsedMs":started.elapsed().as_secs_f64()*1000.0,
            "meetsTeachingTarget":position_rms<=if drive_cut {3.0} else {1.5} && heading_rms<=2.0
                && (!drive_cut || maximum_position<=8.0)});
        println!("{record}");
        records.push(record);
    }
    let report = json!({"schema":"act.semisub-dp-validation.v1","sourceContributions":"DUOK+HASBO",
        "loadComparison":loads,"runs":records,"scope":"native release, frozen tables, 16 representative frequency bands and 7 directions; browser and network measured separately"});
    std::fs::write(&arguments[1], serde_json::to_string_pretty(&report)? + "\n")?;
    println!("load comparison {}", report["loadComparison"]);
    Ok(())
}
