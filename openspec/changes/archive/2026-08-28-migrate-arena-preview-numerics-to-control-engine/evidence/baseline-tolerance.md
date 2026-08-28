# Preview baseline and tolerance

黑箱 cruise-roll 预览的数值真源是 `rust/control-engine/src/arena_preview.rs`。

固定夹具：

- `controllerGain=1.6`，`dampingCompensation=0.72`，`energyBudget=12`，`initialRoll=0.2`
- `sampleTime=0.2`，`steps=61`，`modelRelation=surrogate`
- surrogate 植物系数：`plantDamping=0.72`，`plantStiffness=1.18`，`plantInputGain=0.68`

验收：

- 轨迹长度 61，全部有限
- `trackingError`、`maxDeviation`、`controlEnergy`、`smoothness` 有限
- 与同夹具重算比较使用 abs `1e-6` 或 rel `1e-3`，超出则 `unavailable`，不得放宽容差后写入成功预览
- 不保存完整高频数组精确快照

identified 夹具必须把上述三个植物系数作为 `authorizedModelParameters` 交给 Rust；缺任一系数 fail closed，且植物系数变化必须改变 summary。
