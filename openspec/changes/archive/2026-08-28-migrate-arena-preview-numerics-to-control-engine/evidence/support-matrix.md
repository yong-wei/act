# Arena preview support matrix

捕获修订：实现时工作树 HEAD。协议：`arena-preview-control-engine/v1`。

| method | supported | modelId | capability | executor | request | result | identity | tolerance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| black-box-control | yes | `arena_cruise_roll_preview` | `computeArenaVirtualPreview` | browser display / server persist | `ArenaCruiseRollPreviewRequest` | trace + summary + identity | task/dataset/model/controller + consumed plant coefficients | abs `1e-6` / rel `1e-3` |
| pid | yes | `control_analysis` | `computeAnalysis` | browser | `ControlAnalysisRequest` | `ControlAnalysisResult` metrics | analysis caseId + plant/controller structures | analysis facade finite-tree |
| serial-compensator | yes | `control_analysis` | `computeAnalysis` | browser | `ControlAnalysisRequest` | `ControlAnalysisResult` metrics | same as pid | analysis facade finite-tree |
| composite-compensation | no | — | — | none | — | `unavailable` | — | — |
| optimized-pid | no | — | — | none | — | `unavailable` | — | — |
| mpc | no | — | — | none | — | `unavailable` | — | — |
| code-controller | no | — | — | none | — | `unavailable` | — | — |

未登记 method 禁止 TypeScript Euler、heuristic 或 `template-preview` 替代。官方 `template-whitebox-v1` 仍只服务官方评测，不构成预览能力。

黑箱预览由 Rust 以固定 `dt=0.2`、61 点批量积分；客户端不保留独立 Euler loop，也不用 `setInterval` 驱动植物。
