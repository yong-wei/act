## Context

样板（destroyer）已交付共享管线，lng / container / cruise 已完成零模块改动复用。drilling 是第五个消费方，两个结构差异首次出现：

1. **DP 动力定位工况**：平台不巡航，`platformStateRef.current`（SemiSubmersible3DOFState：x/y/psi/u/v/r + 8 推进器）存于 ref 而非 React state；位姿在渲染时派生（`platformPosition = {x: state.x, z: state.y}`，`platformHeading = state.psi` 弧度）。运动学为 `dx = u·cos ψ − v·sin ψ`、`dy = u·sin ψ + v·cos ψ`（`rust/control-engine/src/virtual_simulation_runtime.rs:1317-1318`），即平台 forward=(cos ψ, 0, sin ψ) 约定。
2. **无 HeadingIndicator**：其余实验移入教学标注开关的对应物不存在；drilling 的场景辅助层为 `TargetMarker`（DP 目标点）与 `TrajectoryLine`。

约束真源：`docs/Simulation_Guidelines.md`、`docs/grill/virtual-simulation/`、已归档能力 spec、`scene/heading.ts` 约定注释。

## Decisions

### 1. 集成映射（drilling 旧件 → 管线）

- `MaritimeEnvironment` + 旧灯 → `<Suspense fallback={null}><EnvironmentScene /></Suspense>` + `<DrillingWater />`（GerstnerWater + useEnvironmentWaterColors + useSceneQuality；positionSampler 读 `platformStateRef`）。
- 无艉迹 → `<WakeTrailRig>`：与前三实验不同，采样器直接读 `platformStateRef.current`——`transformRef.position = [x, 0, y]`、`transformRef.heading = platformHeadingToSceneRad(toDegrees(psi))`、`worldSpeedSampler = () => Math.hypot(u, v)`；`key={resetToken}`（新增 `resetCount` state，`handleReset` 自增）。
- `UnifiedCameraController` → `<StayPutCameraController>`：`positionSampler={() => ({ x, z: y })}`、`headingSampler={() => platformHeadingToSceneRad(toDegrees(psi))}`、shipLength 取档案 114。
- 后处理 `<ScenePostEffects />`；`SceneQualityAttributes`；SoundscapeAmbienceDriver + SceneQualityDriver。
- 删除旧灯。drilling 无独立 Scene 组件（Canvas 内联于主组件 return），桥接组件仍抽出为独立函数组件。

### 2. 教学标注归一

- `TrajectoryLine` 保留常驻（既有条件渲染 `length > 1` 不动）。
- `TargetMarker` 移入 `TeachingAnnotationsToggle` 门控（默认关闭）：目标点 x/z 坐标与目标艏向在控制面板以滑块+数值完整呈现（`drilling-simulation.tsx:604-630`），3D 标记属面板数据的场景辅助，与 HeadingIndicator（面板航向数据的场景辅助）同类先例。

### 3. DP 低速工况的尾迹语义

- 档案 `designSpeedKnots: 8`（HYSY981 真实转场航速量级）作 Froude 归一；DP 工况速度 0–2 m/s 对应 Froude 分数 0–0.5，尾迹低活跃为物理正确，不为观感夸大打水。
- `worldSpeedSampler` 取体轴速度模 `hypot(u, v)`（米/秒模型语义），保证播放倍率不改变 Froude 活跃度。
- 锚点按半潜双浮筒布局：stern [0,0,−57]、shoulders [±39,0,−34]（±39m 为双浮筒中心线间距之半， WIDTH 78/2）。

### 4. 船模与档案

- 新增 `profiles/drilling-hysy981-scene.ts`：`SceneShipVisualProfile`（shipLengthMeters 114、designSpeedKnots 8、modelUrl `/assets/models-opt/drilling-rig.glb`、waterlineY 0、锚点如上）。
- meshopt 优先 + `ModelAssetErrorBoundary` 回退 + `frustumCulled=false`；preload 仅压缩件；模型自带 `rotation.y = -ψ + π/2` 轴向补偿保持不变。

### 5. 验证

- 源断言：drilling 集成标记（同样板断言组）+ 无 UnifiedCameraController/MaritimeEnvironment + 档案契约 + 重置/速度模语义（`Math.hypot`）+ 航向适配接线断言（两处采样点经 `platformHeadingToSceneRad(toDegrees(`）+ TargetMarker 门控断言。
- Playwright：drilling 路由冒烟。
- 浏览器 QA：跟船/顶视可见、重定位机动中尾迹低活跃位于艉向、五预设、档位、标注开关（TargetMarker 显隐）、移动端。

## Risks

- **TargetMarker 默认关闭的任务流影响**：DP 任务"到点"的空间参照转为先开标注；坐标在面板完整可读，且开关一键可达（与 HeadingIndicator 同等待遇）。若后续教学反馈认为目标点应常驻，单点改回即可（设计留有此退路）。
- **ref 直读采样器与 React 渲染节奏**：采样器在 useFrame 内读 ref，与管线帧循环同拍；platformPosition 的渲染派生路径（metrics 驱动重渲染）保持原样，两路消费互不干扰。
- **尾迹低活跃被误读为失效**：QA 以"重定位机动中尾迹位于艉向且随速度起伏"为验收口径，不以巡航级尾迹密度为预期。
