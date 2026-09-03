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
