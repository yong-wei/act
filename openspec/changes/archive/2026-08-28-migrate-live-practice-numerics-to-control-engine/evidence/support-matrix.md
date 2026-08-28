# Practice live Control Engine 能力矩阵

捕获修订：`3d0c514aa`（#1600 合入后的 #1601 claim 基线）。

调度合同：

- 七个 standalone scene：`dt=1/60`，`maxSubSteps=120`
- Control Odyssey：`dt=1/60`，`maxSubSteps=6`

容差：summary / 单步标量 abs `1e-6` 或 rel `1e-3`；超出则 unavailable，不放宽阈值。浏览器 façade 输出 `persisted=false`；持久化仍走 Practice `SimulationRun` writer。

| 场景 / 路径 | 状态 | modelId | executor | 说明 |
| --- | --- | --- | --- | --- |
| Cruise plant + heading PID + wave + notch + fin | migrated | `practice_cruise_live_step` | browser façade | 植物复用 `roll_coupled_nomoto` |
| Cruise comfort metrics | migrated | `practice_cruise_comfort_realtime` | browser façade | 实时 MSI/VDV |
| container heading PID | migrated | `practice_pid_control` + `nomoto1st` / `container_roll` | browser façade | Gain schedule 见下 |
| container gain schedule | migrated | `practice_gain_schedule_step` | browser façade | 调度后仍走 PID capability |
| container wind | migrated | `practice_wind_load_step` | browser façade | |
| destroyer live | migrated | `destroyer_hifi` | browser façade | 页面 `runtimeReady` 门禁 |
| dredger DP + MMG | migrated | `practice_dp_control` + `mmg3dof` | browser façade | |
| dredger impact | migrated | `practice_dredging_disturbance` | browser façade | RNG 采样与原 TS 分支对齐 |
| drilling DP + env + thrust | migrated | `practice_dp_decoupled_control` / `practice_allocate_thrust` / `practice_drilling_environment` + `semisub3dof` | browser façade | |
| icebreaker azipod + ice | migrated | `practice_azipod_course_keeper` / `practice_ice_breaking_step` + `azipod3dof` | browser façade | |
| LNG Smith + sloshing + 2nd-order PID | migrated | `practice_smith_predictor` / `practice_sloshing_step` / `practice_pid_2nd_order` + `nomoto2nd_delay` | browser façade | |
| Control Odyssey | migrated | `compute_simulation_step` | browser façade | 保持 `maxSubSteps=6`；未就绪不推进 |

兼容适配（非步进）：`createPIDControllerState`、`createSmithPredictorFullState`、`createSloshingState`、`createWindEnvironment`、`createFinStabilizerState`、`createNotchFilterState`、Bode/`get*Metrics`、解耦 tracker。删除条件见 R6 台账。
