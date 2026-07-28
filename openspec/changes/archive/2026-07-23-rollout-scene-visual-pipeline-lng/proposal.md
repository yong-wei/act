## Why

场景视觉管线已在 destroyer 样板落地并归档（PR #997，`simulation-scene-visual-pipeline` 能力成立）。本次把它推广到第二个实验——LNG 运输船（长恒系列，295m / 巡航 19 kn），验证"共享管线按 ship profile 参数化、模块零实验硬编码"的核心架构承诺，同时把 lng 场景从旧的共享 `MaritimeEnvironment`（正弦海面 + 渐变天空 + 程序云）升级到同一观感参照。

## What Changes

- `lng-simulation.tsx` 全量接入管线：`EnvironmentScene` + `PresetWater`（Gerstner 海面按 lng 档案水色预设）替换 `MaritimeEnvironment` 与两盏旧灯；`WakeTrail` 新增尾迹粒子场（lng 原本无艉迹，worldSpeedSampler 取 `state.speed`）；`StayPutCameraController` 替换 `UnifiedCameraController`（停留语义 + 四个预设镜头接入 `CameraViewSwitcher` views prop）；`ScenePostEffects` 后处理。
- 管线状态层接入：SceneEnvironmentProvider（预设切换器）、SceneSoundscapeProvider（音景+静音）、TeachingAnnotationsProvider（教学标注开关）、SceneQualityProvider（档位+QA 属性）。
- 教学标注归一：保留 `TrajectoryLine` 作为实际航迹线（默认常驻）；`HeadingIndicator`（当前/目标航向）移入"教学标注"开关（默认关闭）。
- 船模链路：lng 视觉档案（`SceneShipVisualProfile`：295m/19kn/锚点）；`/assets/models-opt/Lng-carrier.glb`（构建链已压缩 14.9MB→4.1MB）+ ErrorBoundary 回退原始 GLB；量化包围球误剔除按样板同口径 `frustumCulled=false` 处理。
- 面板、评估语义、控制器算法、Smith 预估器、晃荡耦合、驱动链零改动；`CameraViewSwitcher` 复用样板的 views prop 机制，不新增共享 chrome。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `simulation-scene-visual-pipeline`：在"共享管线服务全部实验"要求下新增 lng 消费场景，证明管线模块按 ship profile 复用、无实验硬编码。

## Impact

- 改写 `src/resources/simulations/simulations/lng-simulation.tsx`（Scene 组合与主组件 provider 包裹）；新增 `src/resources/simulations/profiles/lng-changheng-scene.ts`。
- 测试：新增 lng 推广契约断言（镜像样板集成断言 + lng 档案契约 + 重置/航速语义）；Playwright 性能 spec 增加 lng 路由冒烟。
- 显式非目标：不改仿真数值模型、SimulationClock、engine-factory/facade、Rust/WASM modelId、SceneSpec/Trace 协议、面板结构与评估语义、其他实验页面；不重生成船模；lng 的 React state 逐帧更新模式保持原样（仅经采样器消费）。
- 决策记录：`docs/grill/virtual-simulation/`（同样板）。
