## Why

虚拟仿真是平台重头戏，但场景观感距离"精美互动游戏"目标仍有明显差距：无后处理与粒子系统（依赖中不存在），海面为五层正弦叠加而非几何涌浪（`src/resources/simulations/environment/wave-water.tsx`），天空是 1.3KB 渐变穹顶、云是 2.4KB 程序贴片，仅 destroyer 有简单的 drei `Line` 艉迹，仪表为 DOM 进度条模拟，11–32MB 的 GLB 船模仅有文本加载占位；相机还存在两处"弹回默认视角"机制（`src/resources/simulations/components/camera-controller.tsx:172-174` 切换清零偏移、`:451-467` 逐帧回拉锁船）。

仿真驱动链（SimulationClock → engine-factory → Rust/WASM modelId）已完备且不可动；Remotion 视频项目（`/Users/YW/Documents/Project/Videos`）拥有可移植的尾迹粒子场、11 模式相机导演系统与 5 套环境预设，其 `scenario/` 目录为纯 TS 零耦合数学层，且 three/R3F 版本与平台完全一致。grill 访谈共识（`docs/grill/virtual-simulation/CONTEXT.md` 及 4 份 ADR）已确认：场景游戏级 + 面板保持控制台气质，以《战舰世界》的海面/舰船/尾流写实观感为唯一验收参照；先做 destroyer 样板跑通管线，其余 6 个实验后续逐个串行变更推广。

## What Changes

- 新建共享场景视觉管线（`src/resources/simulations/scene/`）：Gerstner 几何涌浪海面、移植并实时化的尾迹粒子场（含开尔文臂，逐帧全量重建改为环形缓冲增量更新）、5 套环境预设（与视频系统同一套环境语言）、光照/雾预设、后处理（引入 `@react-three/postprocessing`）、质量分级与自动降档——全部抽象为共享模块，按 ship profile 参数化，不写死在单个仿真实验内。
- 重设计相机系统：自由视角带阻尼手感，预设电影镜头（移植 Remotion 相机导演模式子集）镜头间平滑过渡；停留语义——交互结束后不主动回拉、跨模式切换保留各视角偏移、target 不强制锁船，根除两处弹回机制。
- 引入音景：环境声（随环境预设联动）+ 操作反馈音 + 告警音，默认开启（受浏览器自动播放策略约束，首次用户手势后解锁），场景内一键静音。
- 教学标注默认精简：场景内默认只保留实际航迹线；航向弧线、目标航线、方向箭头、世界标签收进"教学标注"开关（默认关闭、按需启用）；标注件显示效果与写实场景协调，不照搬视频样式。
- destroyer（052D）作为样板实验接入全部管线；GLB 资产做 Draco/meshopt 压缩（重编码不改变外观，不属于"重新生成模型"禁区），加载期先出海面与环境、船模带进度就位。
- 面板/壳层保持指挥甲板控制台气质不变；SceneSpec v1 / SimulationTrace v1 不变，显式声明视觉呈现层偏好（环境预设、画质档位、相机、音景、标注可见性）在协议之外。
- 既有 `simulation-scene-shell-architecture` 的"场景按明暗主题换参"要求改写：场景本体改由手动环境预设驱动（与主题脱钩），面板、HUD、网格、标签等 chrome 元素仍按主题换参。

## Capabilities

### New Capabilities

- `simulation-scene-visual-pipeline`：共享场景视觉管线——海面/尾迹/环境预设/相机/音景/质量分级/渐进加载/教学标注的模块契约，观感参照锚定验收，驱动链与协议语义保持，相机停留语义。

### Modified Capabilities

- `simulation-scene-shell-architecture`：将"Simulation scenes expose theme-aware visual parameters"修改为场景本体由环境预设驱动、面板与 chrome 元素保持主题化。
- `simulation-scene-trace-protocol`：新增呈现层偏好排除要求，显式声明视觉层不纳入 SceneSpec/Trace。

## Impact

- 新增 `src/resources/simulations/scene/`（water、wake、environment、camera、audio、quality、annotations、post 模块）与 `public/assets/simulation-scene/`（移植贴图/环境资产、压缩 GLB）；改写 `src/resources/simulations/simulations/destroyer-simulation.tsx` 场景挂载；`camera-controller.tsx` 与 `wave-water.tsx` 被管线模块取代（旧文件按迁移边界处理）。
- `package.json` 新增 `@react-three/postprocessing`（其余按需，逐一裁决）；GLB 压缩进构建链路。
- 移植源：`/Users/YW/Documents/Project/Videos` 的 `scenario/` 纯 TS 层与 `public/control-video/three/ship-scene/` 资产；去除 Remotion 耦合点（`useRemotionAsset`、`staticFile`、`useCurrentFrame`、`ThreeCanvas`）。
- 本变更仅含 destroyer 样板；lng/container/cruise/drilling/icebreaker/dredger 的推广为后续独立变更，逐个串行 PR（cruise 的几何偏差在其顺位处理）。
- 显式非目标：不改仿真数值模型、SimulationClock、engine-factory/facade、Rust/WASM modelId、SceneSpec/Trace 协议、面板结构与评估语义；不重新生成船舶 3D 模型；不动遗留单体 `src/resources/simulations/destroyer-simulation.tsx`（回归测试按文本读取它）；不扩散 `physics/controllers|disturbances` 的 TS 残留。
- 决策记录：`docs/grill/virtual-simulation/adr/`（观感参照锚定、场景主题脱钩、视觉层协议外、音景默认开启）。
