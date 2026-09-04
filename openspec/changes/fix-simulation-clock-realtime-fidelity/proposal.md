## Why

2026-09-04 QA 深测（Issue #1945，P2）发现 `/simulations/container`（集装箱货轮）倍速 1.0x 时仿真时钟明显慢于真实时间，控制状态本身正常。同类 churn 模式还存在于 lng、cruise 两页。

调查结论（2026-09-04）：
- **主因：仿真循环 effect 每帧重跑导致时钟系统性欠计。** `simulationLoop` 的 `useCallback` deps 含每帧变化的 `simState.time`（container-simulation.tsx:916），启动 effect 依赖该回调（:931），于是每个渲染帧 teardown+重跑：`clock.reset()` 丢弃 accumulator 余数（:921），`lastTimeRef` 基线重定为 React commit+effect flush 时刻（:922）——每帧净丢 W（rAF 回调+渲染+commit 耗时）。60Hz 下 W=3ms 时钟只剩 82%、W=8ms 只剩 52%；叠加每帧不节流的全量 `setSimState`（:902-912，对比 destroyer 的 0.1s 节流），container 因渲染最重（后处理+阴影+AA）最先暴露。
- 对照组证明这是模式差异而非内核差异：destroyer（R3F useFrame+ref）、icebreaker（闭包 rAF+ref）、drilling/dredger（rAF+timeRef）都不丢时。
- 次因：帧 delta 250ms clamp（`simulation-timing.ts:12,18,37`）在 <4fps 时欠计（放大器，防切后台大步长的正确行为，文档化即可）。
- 附带发现：AGENTS.md:77 描述 `maxSubSteps: 6` 与实际 `SIMULATION_MAX_SUB_STEPS = 120` 漂移（真正用 6 的是 lesson-13/control-odyssey 教学页）；container 无功率遥测（QA 备注，与其他多数船舶页一致，本变更不扩 UI 范围）。

## What Changes

- container/lng/cruise 三页仿真循环改为稳定引用模式：时间、速度等每帧变化的量走 ref，循环回调与启动 effect 的 deps 稳定（对齐 destroyer/icebreaker/drilling 模式），消除每帧 `clock.reset()` 与基线重定。
- container 的 HUD/图表 setState 增加节流（对齐 destroyer 0.1s 口径），降低每帧渲染负担。
- 1.0x 时钟保真验收：正常帧率下 60 s 墙钟与仿真时钟偏差 < 5%。
- 增加调度契约测试：仿真运行期间循环 effect 不因时间状态变化而重建、accumulator 长期守恒（不因 reset 丢弃）。
- 更新 AGENTS.md 的 `SimulationClock` 参数描述（maxSubSteps 实际值 120），并在仿真指南文档化「帧率低于 4fps 时时钟按 clamp 退化」的既有行为。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `resource-simulation-state-effect-safety`: 仿真循环的 React effect 必须引用稳定，不得因每帧状态更新而 teardown/重建导致时钟 accumulator 丢弃与时间欠计。

## Impact

- `src/resources/simulations/simulations/container-simulation.tsx`、`lng-simulation.tsx`、`cruise-simulation.tsx`（循环稳定化与 HUD 节流）。
- 调度契约测试（新建）。
- `AGENTS.md` 与仿真文档的时钟参数描述修正。
- 显式非目标：不改数值模型与固定步长语义（SimulationClock/simulation-timing 内核不动）；不保证极端低帧率（<4fps）下严格实时（clamp 行为文档化）；不新增功率 UI（QA 备注项，另行裁决）；不改 destroyer/icebreaker/drilling/dredger 已正确模式。
