## Why

场景视觉管线已在 destroyer 样板落地（PR #997）并经 lng（PR #1002）、container（PR #1004）、cruise（PR #1006）三次零模块改动复用。本次推广到第五个实验——海洋石油 981 半潜式钻井平台（114m×78m，DP 动力定位 + 推进器失效伦理决策），把 drilling 场景从旧的共享 `MaritimeEnvironment` 升级到同一观感参照。drilling 是系列中第一个非巡航工况（DP 低速）与第一个 ref 直连状态（非 React state）的消费方，验证管线采样器对两种状态供给模式的适配。

## What Changes

- `drilling-simulation.tsx` 接入管线：`EnvironmentScene` + Gerstner 海面桥接替换 `MaritimeEnvironment` 与两盏旧灯；`WakeTrail` 新增尾迹粒子场（worldSpeedSampler 取 `hypot(u, v)` 体轴速度模，米/秒模型语义；DP 低速工况下尾迹低活跃为物理正确）；`StayPutCameraController` 替换 `UnifiedCameraController`；`ScenePostEffects` 后处理。
- 管线状态层接入：SceneEnvironmentProvider / SceneSoundscapeProvider / TeachingAnnotationsProvider / SceneQualityProvider + 底部 chrome 四件套 + SceneQualityAttributes。
- 教学标注归一：`TrajectoryLine` 保留常驻；`TargetMarker`（DP 目标点）移入教学标注开关（默认关闭）——其坐标/艏向在控制面板以数值与滑块完整呈现，3D 标记属面板数据的场景辅助（HeadingIndicator 先例同例）。
- 船模链路：drilling 视觉档案（`SceneShipVisualProfile`：114m/8kn/锚点，双浮筒肩锚点 ±39m）；`/assets/models-opt/drilling-rig.glb` + ErrorBoundary 回退原始 GLB；`frustumCulled=false` 同口径。
- 航向约定：平台状态 psi（弧度，运动学 forward=(cos ψ,0,sin ψ)）经 `platformHeadingToSceneRad(toDegrees(psi))` 接线两处采样点；采样器直接读 `platformStateRef`（drilling 无 React 位姿 state）。
- 面板、DP 控制律、推进器布局/失效注入、伦理决策记录、风流场环境模型、驱动链零改动。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `simulation-scene-visual-pipeline`：在"共享管线服务全部实验"要求下新增 drilling 消费场景（DP 低速 + ref 直连状态供给）。

## Impact

- 改写 `src/resources/simulations/simulations/drilling-simulation.tsx`（Canvas 组合与主组件 provider 包裹）；新增 `src/resources/simulations/profiles/drilling-hysy981-scene.ts`。
- 测试：新增 drilling 推广契约断言（镜像样板集成断言 + drilling 档案契约 + 重置/速度模/航向适配语义 + TargetMarker 门控）；Playwright 性能 spec 增加 drilling 路由冒烟。
- 显式非目标：不改仿真数值模型、SimulationClock、engine-factory/facade、Rust/WASM modelId、SceneSpec/Trace 协议、面板结构与评估语义、其他实验页面；不重生成平台模型；`platformStateRef` 直读模式保持原样（仅经采样器消费）。
- 决策记录：`docs/grill/virtual-simulation/`（同样板）。
