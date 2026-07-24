## Why

场景视觉管线已在 destroyer 样板落地（PR #997）并经 lng（PR #1002）、container（PR #1004）两次零模块改动复用。本次推广到第四个实验——爱达·魔都号豪华邮轮（323.6m / 巡航 9.3 m/s ≈ 18 kn，舒适度控制 + 减摇鳍 + 陷波滤波，系列中最复杂的组件，且嵌入课程模式与 Arena 黑箱任务）。

同时顺带闭环其页面几何偏差：2026-06-15 产品审计（`artifacts/product-design-audits/virtual-simulation-2026-06-15-audit/audit.md`）记录 cruise 桌面场景约 984×1362、其余仿真约 1320×930。该偏差源于当时 shell 的 workspaceSlots 路径；当前 `SimulationShell` 已将结构化槽位渲染于场景框架之后，本变更以实测与自动化断言闭环该审计项，防止回归。

## What Changes

- `cruise-simulation.tsx` 接入管线：`EnvironmentScene` + Gerstner 海面桥接替换 `MaritimeEnvironment` 与两盏旧灯；`WakeTrail` 新增尾迹粒子场（worldSpeedSampler 取 `state.speed`，米/秒模型语义）；`StayPutCameraController` 替换 `UnifiedCameraController`；`ScenePostEffects` 后处理。
- 管线状态层接入：SceneEnvironmentProvider / SceneSoundscapeProvider / TeachingAnnotationsProvider / SceneQualityProvider + 底部 chrome 四件套 + SceneQualityAttributes（嵌入课程模式同样接入，视觉升级保持一致）。
- 教学标注归一：`TrajectoryLine`（实际航迹）与 `DesiredRouteLine`（期望航线，控制目标可视化）保留常驻；`HeadingIndicator` 移入教学标注开关（默认关闭）。
- 船模链路：cruise 视觉档案（`SceneShipVisualProfile`：323.6m/18kn/锚点）；`/assets/models-opt/luxury-liner.glb` + ErrorBoundary 回退原始 GLB；量化包围球误剔除按样板同口径 `frustumCulled=false`。
- 航向约定：Wake 与 Camera 两处采样点统一经 `platformHeadingToSceneRad` 接线。
- 海况视觉语义：`MaritimeEnvironment` 的 seaState 海面随其退役，海面观感改由环境预设驱动；`seaState`/`waveDirection` 对横摇动力学的数值影响与控制面板保持不变（驱动链零改动）。
- 几何偏差闭环：Playwright 新增 cruise 与 lng 场景容器（`[data-sim-ui]`）几何一致性断言。
- 面板、评估语义、遥测桥、AI 伴学、课程模式逻辑、Arena 提交面板（page.tsx）零改动。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `simulation-scene-visual-pipeline`：在"共享管线服务全部实验"要求下新增 cruise 消费场景；新增"cruise 场景几何与其余仿真一致"场景闭环历史审计项。

## Impact

- 改写 `src/resources/simulations/simulations/cruise-simulation.tsx`（VisualizationLayer 组合与主组件 provider 包裹）；新增 `src/resources/simulations/profiles/cruise-adora-scene.ts`。
- 测试：新增 cruise 推广契约断言（镜像样板集成断言 + cruise 档案契约 + 重置/航速/航向适配语义 + DesiredRouteLine 保留）；Playwright 性能 spec 增加 cruise 路由冒烟与场景几何一致性断言。
- 显式非目标：不改仿真数值模型、SimulationClock、engine-factory/facade、Rust/WASM modelId、SceneSpec/Trace 协议、面板结构与评估语义、课程模式与 Arena page.tsx、其他实验页面；不重生成船模；cruise 的 React state 逐帧更新模式保持原样。
- 决策记录：`docs/grill/virtual-simulation/`（同样板）。
