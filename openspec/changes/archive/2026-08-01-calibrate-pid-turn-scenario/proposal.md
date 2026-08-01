## Why

PID 推荐器把固定的 90 度硬拐角当作评分基准，但参考路径从 `x=-6000` 开始，仿真从 `x=0` 开始；同时船模没有舵机速率约束，稳定时间又按首次进入误差带计算。默认 Nomoto 参数下，任何 PID 组合都会得到约 25 分的不可完成结果，并向学生给出无法通过调参解决的建议。

推荐评分必须反映可执行的船舶转向任务，才能作为控制学习中的可信诊断依据。

## What Changes

- 用从仿真起点出发的圆弧航向参考替代坐标错位的几何硬拐角，并将参考轨迹、目标航向和评测时间窗定义为同一场景。
- 在快速 Nomoto 运行时支持可选的实际舵角速率限制；PID 输出继续作为舵角命令，评分使用实际舵角变化率。
- 将稳定时间改为最终航向参考完成后首次进入并持续停留在容差带内的时间，采用适合 90 度机动的 5 度容差和经过校准的时限。
- 扩展 PID 搜索边界，使推荐器能搜索到满足路径误差、舵速、超调和持续稳定约束的参数。
- 增加确定性测试，证明推荐场景可得到 60 分以上结果，且评分输入保留可重放性。

## Capabilities

### New Capabilities
- `pid-turn-scenario-calibration`: 定义可执行的 90 度船舶转向参考、执行器约束、持续稳定规则和推荐评分验收条件。

### Modified Capabilities
- `simulation-runtime-replayability`: 将评分场景的航向日程和执行器限制纳入确定性重放输入。

## Impact

- `src/resources/simulations/lib/monte-carlo-optimizer.ts`
- `rust/control-engine/src/virtual_simulation_runtime.rs`
- `rust/control-engine/tests/virtual_simulation_runtime.rs`
- `src/resources/simulations/__tests__/simulation-replay-determinism.test.ts`
- 仿真参数推荐 API 的 `metrics` 和 `score` 语义；不影响 Arena 官方评测、排行榜或学习证据写入。
