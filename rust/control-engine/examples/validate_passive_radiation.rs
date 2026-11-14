use control_engine::sixdof::model_pack::embedded_vessel_pack_with_water_depth;
use std::fs::{read_to_string, File};
use std::io::{BufWriter, Write};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    if arguments.len() != 4 && arguments.len() != 6 {
        return Err("需要船型、参数版本、频率JSON、输出CSV，可追加加载比例和水深".into());
    }
    let ratio = arguments.get(4).map(|value| value.parse::<f64>()).transpose()?;
    let depth = arguments.get(5).map(|value| value.parse::<f64>()).transpose()?;
    let pack = embedded_vessel_pack_with_water_depth(&arguments[0], &arguments[1], ratio, depth)
        .map_err(|error| format!("参数包无效 {error:?}"))?;
    let model = pack.geometry.passive_radiation.as_ref().ok_or("参数包没有被动辐射数据")?;
    model.validate()?;
    let frequencies: Vec<f64> = serde_json::from_str(&read_to_string(&arguments[2])?)?;
    let added = model.added_mass();
    let mut output = BufWriter::new(File::create(&arguments[3])?);
    writeln!(output, "omega_rad_s,row,column,added_mass_si,damping_si")?;
    for frequency in &frequencies {
        if !frequency.is_finite() || *frequency <= 0.0 {
            return Err("校核频率须为有限正值".into());
        }
        let response = model.impedance(*frequency)?;
        for row in 0..6 {
            for column in 0..6 {
                let mass = added[row][column]+response[row][column].im/frequency;
                writeln!(output, "{frequency:.17e},{row},{column},{mass:.17e},{:.17e}", response[row][column].re)?;
            }
        }
    }
    output.flush()?;
    println!("{}", serde_json::json!({"status": "computed", "vessel": arguments[0],
        "parameter_version": arguments[1], "parameter_hash": pack.content_hash,
        "frequencies": frequencies.len(), "oscillators": model.oscillators.len(),
        "radiation_states": model.state_len()}));
    Ok(())
}
