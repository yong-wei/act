//! Control-engine WASM facade: request decode, dispatch and export boundary.
//!
//! Numerical implementations live in the sibling modules (`analysis`,
//! `controllers`, `simulation`, `metrics`, ...); this root module only
//! decodes facade requests and forwards them to the owning module.

use wasm_bindgen::prelude::*;

pub mod analysis;
pub mod arena_preview;
pub mod constraints;
pub mod control_odyssey_runtime;
pub mod controllers;
pub mod destroyer_hifi;
pub mod destroyer_hifi_runtime;
pub mod metrics;
pub mod practice_cruise_live;
pub mod practice_live;
pub mod practice_live_platform;
pub mod sixdof;
pub mod sixdof_runtime;
pub mod virtual_simulation_runtime;

use crate::analysis::{
    ControlAnalysisRequest, NonlinearAnalysisRequest, compute_analysis_inner,
    compute_nonlinear_analysis_inner,
};

use crate::controllers::{RlTrainingRequest, compute_rl_training_inner};

#[wasm_bindgen]
pub fn compute_analysis(request_json: &str) -> Result<String, JsValue> {
    let request: ControlAnalysisRequest = serde_json::from_str(request_json)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    if let Some(message) =
        analysis::analysis_request_errors(&request.runtime_mode, request.outputs.is_empty())
    {
        return Err(JsValue::from_str(message));
    }
    let result = compute_analysis_inner(&request);
    serde_json::to_string(&result).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen]
pub fn compute_nonlinear_analysis(request_json: &str) -> Result<String, JsValue> {
    let request: NonlinearAnalysisRequest = serde_json::from_str(request_json)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    if request.runtime_mode != "nonlinear_analysis" {
        return Err(JsValue::from_str("只支持 nonlinear_analysis 模式请求。"));
    }
    let result = compute_nonlinear_analysis_inner(&request);
    serde_json::to_string(&result).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen]
pub fn compute_rl_training(request_json: &str) -> Result<String, JsValue> {
    let request: RlTrainingRequest = serde_json::from_str(request_json)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    let result = compute_rl_training_inner(&request);
    serde_json::to_string(&result).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[wasm_bindgen]
pub fn compute_simulation_step(request_json: &str) -> Result<String, JsValue> {
    control_odyssey_runtime::compute_simulation_step_json(request_json)
        .map_err(|error| JsValue::from_str(&error))
}

#[wasm_bindgen]
pub fn compute_virtual_simulation_step(request_json: &str) -> Result<String, JsValue> {
    virtual_simulation_runtime::compute_virtual_simulation_step_json(request_json)
        .map_err(|error| JsValue::from_str(&error))
}

#[wasm_bindgen]
pub struct VesselSimulationSession {
    inner: sixdof::session::FleetSimulation,
}

#[wasm_bindgen]
impl VesselSimulationSession {
    #[wasm_bindgen(constructor)]
    pub fn new(configuration_json: &str) -> Result<VesselSimulationSession, JsValue> {
        let configuration = serde_json::from_str(configuration_json)
            .map_err(|error| JsValue::from_str(&error.to_string()))?;
        let inner = sixdof::session::FleetSimulation::new(configuration)
            .map_err(|error| JsValue::from_str(&error))?;
        Ok(Self { inner })
    }

    #[wasm_bindgen(js_name = withWaveTables)]
    pub fn with_wave_tables(configuration_json: &str, first_metadata: &str, first_bytes: &[u8],
        second_metadata: &str, second_bytes: &[u8]) -> Result<VesselSimulationSession, JsValue>
    {
        let configuration = serde_json::from_str(configuration_json)
            .map_err(|error| JsValue::from_str(&error.to_string()))?;
        let first_order = sixdof::first_order_wave::FirstOrderExcitation::from_json_and_bytes(first_metadata, first_bytes)
            .map_err(|error| JsValue::from_str(&error))?;
        let full_difference = if second_metadata.is_empty() && second_bytes.is_empty() { None } else {
            Some(sixdof::full_qtf::FullDifferenceQtf::from_json_and_bytes(second_metadata, second_bytes)
                .map_err(|error| JsValue::from_str(&error))?)
        };
        let inner = sixdof::session::FleetSimulation::with_wave_assets(configuration,
            sixdof::vessel_wave::WaveModelAssets { first_order, full_difference })
            .map_err(|error| JsValue::from_str(&error))?;
        Ok(Self { inner })
    }

    pub fn advance(&mut self, seconds: f64, input_json: &str) -> Result<String, JsValue> {
        let input = if input_json.is_empty() { None } else {
            Some(serde_json::from_str(input_json).map_err(|error| JsValue::from_str(&error.to_string()))?)
        };
        self.inner.advance(seconds, input).map_err(|error| JsValue::from_str(&error))?;
        self.inner.frame_json().map_err(|error| JsValue::from_str(&error))
    }

    pub fn read(&self) -> Result<String, JsValue> {
        self.inner.frame_json().map_err(|error| JsValue::from_str(&error))
    }

    pub fn snapshot(&self) -> Result<String, JsValue> {
        self.inner.snapshot_json().map_err(|error| JsValue::from_str(&error))
    }

    pub fn restore(&mut self, snapshot: &str) -> Result<(), JsValue> {
        self.inner.restore_snapshot(snapshot).map_err(|error| JsValue::from_str(&error))
    }

    #[wasm_bindgen(js_name = setPaused)]
    pub fn set_paused(&mut self, paused: bool) { self.inner.set_paused(paused); }

    pub fn reset(&mut self) -> Result<(), JsValue> {
        self.inner.reset().map_err(|error| JsValue::from_str(&error))
    }
}
