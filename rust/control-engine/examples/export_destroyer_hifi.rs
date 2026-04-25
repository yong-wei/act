fn main() {
    let report = control_engine::destroyer_hifi::run_destroyer_hifi_experiment();
    println!(
        "{}",
        serde_json::to_string_pretty(&report).expect("serialize destroyer hifi experiment")
    );
}
