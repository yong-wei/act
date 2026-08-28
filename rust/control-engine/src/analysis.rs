//! Analysis request decoding and facade-facing validation.

pub fn analysis_request_errors(runtime_mode: &str, outputs_empty: bool) -> Option<&'static str> {
    if runtime_mode != "analysis" {
        return Some("只支持 analysis 模式请求。");
    }
    if outputs_empty {
        return Some("outputs 不能为空。");
    }
    None
}
