## Why

场景视觉管线已在 destroyer 样板落地（PR #997）并经 lng（PR #1002）、container（PR #1004）、cruise（PR #1006）、drilling（PR #1014）四次零模块改动复用。本次推广到第六个实验——雪龙号破冰船（122.5m / 开阔水域设计航速 15.5kn / 冰区作业 3kn，方位推进 + 冰区安全教学），把 icebreaker 场景从旧的共享 `MaritimeEnvironment` 与自定义 `IceOcean` 冰区海面升级到同一观感参照。

## What Changes

- `icebreaker-simulation.tsx` 接入管线：`EnvironmentScene` + Gerstner 海面桥接替换 `MaritimeEnvironment`、自定义 `IceOcean` 冰区海面与两盏旧灯；`WakeTrail` 新增尾迹粒子场（worldSpeedSampler 取 `state.speed`，米/秒模型语义）；`StayPutCameraController` 替换 `UnifiedCameraController`；`ScenePostEffects` 后处理。
- 管线状态层接入：SceneEnvironmentProvider / SceneSoundscapeProvider / TeachingAnnotationsProvider / SceneQualityProvider + 底部 chrome 四件套 + SceneQualityAttributes。
- 教学标注归一：`TrailLine`（实际航迹）保留常驻；`HeadingIndicator`（目标航向）移入教学标注开关（默认关闭）。
- 冰区视觉语义：`IceOcean` 自定义 shader（冰区减浪/冷色偏移/浮冰斑块）随旧环境退役，冰区观感改由环境预设统一承载；冰厚、冰区安全等级面板与破冰动力学语义保持不变（驱动链零改动）。
- 船模链路：icebreaker 视觉档案（`SceneShipVisualProfile`：122.5m/15.5kn/锚点）；`/assets/models-opt/icebreaker.glb` + ErrorBoundary 回退原始 GLB；`frustumCulled=false` 同口径。
- 航向约定：Wake 与 Camera 两处采样点统一经 `platformHeadingToSceneRad` 接线。
- 面板、方位推进控制、冰区安全等级、破冰动力学、驱动链零改动。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `simulation-scene-visual-pipeline`：在"共享管线服务全部实验"要求下新增 icebreaker 消费场景。

## Impact

- 改写 `src/resources/simulations/simulations/icebreaker-simulation.tsx`（Scene 组合与主组件 provider 包裹）；新增 `src/resources/simulations/profiles/icebreaker-xuelong-scene.ts`。
- 测试：新增 icebreaker 推广契约断言（镜像样板集成断言 + icebreaker 档案契约 + 重置/航速/航向适配语义）；Playwright 性能 spec 增加 icebreaker 路由冒烟。
- 显式非目标：不改仿真数值模型、SimulationClock、engine-factory/facade、Rust/WASM modelId、SceneSpec/Trace 协议、面板结构与评估语义、其他实验页面；不重生成船模；冰区安全教学语义与破冰模型不动。
- 决策记录：`docs/grill/virtual-simulation/`（同样板）。
