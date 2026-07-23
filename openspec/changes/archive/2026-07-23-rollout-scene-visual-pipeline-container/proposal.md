## Why

场景视觉管线已在 destroyer 样板落地（PR #997）并由 lng 完成首次复用实证（PR #1002，`simulation-scene-visual-pipeline` 能力含"第二实验零模块改动复用"场景）。本次把它推广到第三个实验——超大型集装箱船（MSC 系列，399.9m / 巡航 10.3 m/s ≈ 20 kn），把 container 场景从旧的共享 `MaritimeEnvironment`（正弦海面 + 渐变天空 + 程序云）升级到同一观感参照，并复用 lng 期沉淀的航向约定适配器。

## What Changes

- `container-simulation.tsx` 全量接入管线：`EnvironmentScene` + `PresetWater`（Gerstner 海面按预设水色）替换 `MaritimeEnvironment` 与两盏旧灯；`WakeTrail` 新增尾迹粒子场（container 原本无艉迹，worldSpeedSampler 取 `state.speed`，米/秒模型语义）；`StayPutCameraController` 替换 `UnifiedCameraController`（停留语义 + 四个预设镜头接入 `CameraViewSwitcher` views prop）；`ScenePostEffects` 后处理。
- 管线状态层接入：SceneEnvironmentProvider（预设切换器）、SceneSoundscapeProvider（音景+静音）、TeachingAnnotationsProvider（教学标注开关）、SceneQualityProvider（档位+QA 属性）。
- 教学标注归一：保留 `TrajectoryLine` 作为实际航迹线（默认常驻）；`HeadingIndicator`（当前/目标航向）移入"教学标注"开关（默认关闭）；`WindIndicator` 为风场控制联动的实验专属仪器，保留常驻（design §2 裁决）。
- 船模链路：container 视觉档案（`SceneShipVisualProfile`：399.9m/20kn/锚点）；`/assets/models-opt/container.glb`（构建链已压缩）+ ErrorBoundary 回退原始 GLB；量化包围球误剔除按样板同口径 `frustumCulled=false` 处理。
- 航向约定：Wake 与 Camera 两处采样点统一经 `platformHeadingToSceneRad`（`scene/heading.ts`，lng 期沉淀）接线，不复制偏置表达式。
- 面板、评估语义、增益调度 PID、风场模型、负载率/横摇耦合、驱动链零改动；`CameraViewSwitcher` 复用样板的 views prop 机制，不新增共享 chrome。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `simulation-scene-visual-pipeline`：在"共享管线服务全部实验"要求下新增 container 消费场景，进一步证明管线模块按 ship profile 复用、无实验硬编码。

## Impact

- 改写 `src/resources/simulations/simulations/container-simulation.tsx`（Scene 组合与主组件 provider 包裹）；新增 `src/resources/simulations/profiles/container-msc-scene.ts`。
- 测试：新增 container 推广契约断言（镜像样板集成断言 + container 档案契约 + 重置/航速/航向适配语义）；Playwright 性能 spec 增加 container 路由冒烟。
- 显式非目标：不改仿真数值模型、SimulationClock、engine-factory/facade、Rust/WASM modelId、SceneSpec/Trace 协议、面板结构与评估语义、其他实验页面；不重生成船模；container 的 React state 逐帧更新模式保持原样（仅经采样器消费）。
- 决策记录：`docs/grill/virtual-simulation/`（同样板）。
