# R6 删除台账（#1601 记录，删除动作属 R6 / #1602）

本 change 把 live 步进迁到 Control Engine façade。下列 TypeScript 模块仍被状态初始化、诊断或 Bode 引用，不得再作为 live 数值权威。删除条件：R6 证明零 live caller，且 replay/诊断另有替代或确认不再需要。

| 模块 | 当前角色 | 删除条件 |
| --- | --- | --- |
| `physics/controllers/pid-controller.ts` | `createPIDControllerState` 与类型 | live `pidControl` 无 caller 后删除实现 |
| `physics/controllers/smith-predictor.ts` | `createSmithPredictorFullState` | live `smithPredictorControl` 无 caller 后删除实现 |
| `physics/controllers/dp-controller.ts` | 类型与默认增益；`HIGH_PRECISION_DP_GAINS` 仍被 profile 引用 | 步进已走 façade；常数迁出后删除 |
| `physics/controllers/dp-decoupling-controller.ts` | tracker / format / 矩阵说明 | 步进已走 façade |
| `physics/controllers/thruster-allocation.ts` | `createThrusterConfigs`、故障与功率诊断 | `allocateThrust` live 已走 façade |
| `physics/controllers/azipod-course-keeper.ts` | 类型 | 步进已走 façade |
| `physics/controllers/gain-scheduler.ts` | `SchedulerDiagnostics` 类型；类内仍有 TS PID | live 已走 `practice_gain_schedule_step` |
| `physics/controllers/notch-filter.ts` | `createNotchFilterState`、Bode、metrics | live notch 已在 `practice_cruise_live_step` |
| `physics/disturbances/sloshing-model.ts` | create / metrics / alarm | live `sloshingStep` 已走 façade |
| `physics/disturbances/wind-load.ts` | create / metrics / alarm | live `windLoadStep` 已走 façade |
| `physics/disturbances/current-model.ts` | create / typical env | live update/forces 已走 façade |
| `physics/disturbances/dredging-impact.ts` | create 初始状态 | live `compute` 已走 façade 类包装 |
| `physics/disturbances/ice-breaking-model.ts` | 类型 | live `iceBreakingStep` 已走 façade |
| `physics/disturbances/fin-stabilizer.ts` | create / metrics / 功率阈值 | live fin 已在 `practice_cruise_live_step` |

回滚点：按场景/model family 回到迁移前完整 commit。capability 未就绪时该 scene pause/unavailable，不恢复 TS 数值降级。
