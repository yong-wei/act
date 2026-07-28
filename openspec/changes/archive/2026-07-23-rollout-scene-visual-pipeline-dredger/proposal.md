## Why

场景视觉管线已在 destroyer 样板落地（PR #997）并经 lng（PR #1002）、container（PR #1004）、cruise（PR #1006）、drilling（PR #1014）、icebreaker（PR #1015）五次零模块改动复用。本次推广到第七个也是最后一个实验——天鲸号绞吸式挖泥船（127.5m / 作业航速 2.0 m/s，MMG 三自由度操纵 + 疏浚作业教学），把 dredger 场景从旧的共享 `MaritimeEnvironment` 升级到同一观感参照，完成全系列七个实验的统一视觉改造。

## What Changes

- `dredger-simulation.tsx` 接入管线：`EnvironmentScene` + Gerstner 海面桥接替换 `MaritimeEnvironment` 与两盏旧灯；`WakeTrail` 新增尾迹粒子场（worldSpeedSampler 取 `hypot(u, v)` 体轴速度模，米/秒模型语义；作业低速工况下尾迹低活跃为物理正确）；`StayPutCameraController` 替换 `UnifiedCameraController`（旧控制器的 `chaseSideOffset: -240` 自定义随其退役，按管线标准取景，design §2 记录）；`ScenePostEffects` 后处理。
- 管线状态层接入：SceneEnvironmentProvider / SceneSoundscapeProvider / TeachingAnnotationsProvider / SceneQualityProvider + 底部 chrome 四件套 + SceneQualityAttributes。
- 教学标注归一：`TrajectoryLine` 保留常驻；`TargetMarker`（目标点）移入教学标注开关（默认关闭）——其坐标/艏向在控制面板以数值与滑块完整呈现，3D 标记属面板数据的场景辅助（drilling 先例同例）。
- 船模链路：dredger 视觉档案（`SceneShipVisualProfile`：127.5m/12kn/锚点）；`/assets/models-opt/dredger.glb` + ErrorBoundary 回退原始 GLB；`frustumCulled=false` 同口径；模型轴向补偿经 QA 实证修正（GLB 长轴为 X，旧补偿侧移 90°，design §5）；舵角视觉（rudderAngle）保持不变。
- 航向约定：平台状态 psi（弧度，MMG 运动学 forward=(cos ψ,0,sin ψ)）经 `platformHeadingToSceneRad(toDegrees(psi))` 接线两处采样点；采样器直接读 `mmgStateRef`（dredger 无 React 位姿 state，drilling 同构）。
- 面板、MMG 操纵模型、舵角/螺旋桨控制、疏浚作业语义、驱动链零改动。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `simulation-scene-visual-pipeline`：在"共享管线服务全部实验"要求下新增 dredger 消费场景——第七个也是最后一个实验，全系列统一改造完成。

## Impact

- 改写 `src/resources/simulations/simulations/dredger-simulation.tsx`（Canvas 组合与主组件 provider 包裹）；新增 `src/resources/simulations/profiles/dredger-tianjing-scene.ts`。
- 测试：新增 dredger 推广契约断言（镜像样板集成断言 + dredger 档案契约 + 重置/速度模/航向适配语义 + TargetMarker 门控）；Playwright 性能 spec 增加 dredger 路由冒烟。
- 显式非目标：不改仿真数值模型、SimulationClock、engine-factory/facade、Rust/WASM modelId、SceneSpec/Trace 协议、面板结构与评估语义、其他实验页面；不重生成船模；`mmgStateRef` 直读模式保持原样。
- 决策记录：`docs/grill/virtual-simulation/`（同样板）。
