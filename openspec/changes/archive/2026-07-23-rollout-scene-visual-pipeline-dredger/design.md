## Context

样板（destroyer）已交付共享管线，lng / container / cruise / drilling / icebreaker 已完成零模块改动复用。dredger 是第七个也是最后一个消费方，结构与 drilling 同构：平台状态在 `mmgStateRef`（MMG3DOFState：x/y/psi 弧度/u/v/r/rudderAngle/propellerRPM）而非 React state；位姿在渲染时派生（`shipPosition = {x: state.x, z: state.y}`，`shipHeading = state.psi`）；无 HeadingIndicator，场景辅助层为 `TargetMarker`（目标点）与 `TrajectoryLine`；模型自带 `rotation.y = -h + π/2 + π` 轴向补偿与舵角视觉。

约束真源：`docs/Simulation_Guidelines.md`、`docs/grill/virtual-simulation/`、已归档能力 spec、`scene/heading.ts` 约定注释。

## Decisions

### 1. 集成映射（dredger 旧件 → 管线）

- `MaritimeEnvironment` + 旧灯 → `<Suspense fallback={null}><EnvironmentScene /></Suspense>` + `<DredgerWater />`（GerstnerWater + useEnvironmentWaterColors + useSceneQuality；positionSampler 读 `mmgStateRef`）。
- 无艉迹 → `<WakeTrailRig>`（drilling 同构）：采样器直读 `mmgStateRef.current`——`transformRef.position = [x, 0, y]`、`transformRef.heading = platformHeadingToSceneRad(toDegrees(psi))`、`worldSpeedSampler = () => Math.hypot(u, v)`；`key={resetToken}`（新增 `resetCount` state，`handleReset` 自增）。
- `UnifiedCameraController` → `<StayPutCameraController>`：`positionSampler={() => ({ x, z: y })}`、`headingSampler={() => platformHeadingToSceneRad(toDegrees(psi))}`、shipLength 取档案 127.5。
- 后处理 `<ScenePostEffects />`；`SceneQualityAttributes`；SoundscapeAmbienceDriver + SceneQualityDriver。
- 删除旧灯。dredger 无独立 Scene 组件（Canvas 内联于主组件 return），桥接组件仍抽出为独立函数组件。

### 2. 旧相机自定义的取舍

旧 `UnifiedCameraController` 带 `config={{ chaseSideOffset: -240 }}`（跟船镜头横向偏移）。`StayPutCameraController` 按 shipLength 标准取景、无此 prop——该自定义随旧控制器退役，跟船取景回到管线标准（与其他六实验一致）。属视觉层取景统一，非行为回归。

### 3. 教学标注归一

- `TrajectoryLine` 保留常驻（既有条件渲染 `length > 1` 不动）。
- `TargetMarker` 移入 `TeachingAnnotationsToggle` 门控（默认关闭）：目标点坐标与目标艏向在控制面板以滑块+数值完整呈现，3D 标记属面板数据的场景辅助（drilling 先例同例）。

### 4. 作业低速工况的尾迹语义

- 档案 `designSpeedKnots: 12`（天鲸号真实转场航速量级，与仿真 MAX_SPEED 6.0 m/s≈11.7kn 一致）作 Froude 归一；作业速度 2.0 m/s 对应分数约 1/3，重定位机动时尾迹适度、定点作业时低活跃，均为物理正确。
- 锚点按 127.5×22m 船型估算：stern [0,0,−63.75]、shoulders [±11,0,−38.25]。

### 5. 船模与档案

- 新增 `profiles/dredger-tianjing-scene.ts`：`SceneShipVisualProfile`（shipLengthMeters 127.5、designSpeedKnots 12、modelUrl `/assets/models-opt/dredger.glb`、waterlineY 0、锚点如上）。
- meshopt 优先 + `ModelAssetErrorBoundary` 回退 + `frustumCulled=false`；preload 仅压缩件；舵角视觉（rudderAngle prop）保持不变。
- **模型轴向修正（QA 发现）**：旧补偿 `rotation.y = -h + π/2 + π` 按 Z 轴模型假设，但该 GLB 长轴为 X（舰艏 local +X），模型视觉相对运动方向侧移 90°（顶视长轴与轨迹正交、跟船见舷侧）。修正为 `rotation.y = -heading`——舰艏世界方向 (cos h, 0, sin h) 与平台运动学一致。修正后 QA 复核：顶视长轴与轨迹共线、舰艏引领航向、跟船正对舰艉、尾迹位于舰艉。此为既有视觉缺陷（补偿表达式本 diff 前即存在），经 QA 实证后按实验 glue 就地修正（不动驱动链与共享模块），契约测试钉死。

### 6. 验证

- 源断言：dredger 集成标记（同样板断言组）+ 无 UnifiedCameraController/MaritimeEnvironment + 档案契约 + 重置/速度模（`Math.hypot`）语义 + 航向适配接线断言 + TargetMarker 门控 + TrajectoryLine 常驻。
- Playwright：dredger 路由冒烟。
- 浏览器 QA：跟船/顶视可见、作业/机动工况尾迹位于艉向、五预设、档位、标注开关（TargetMarker 显隐）、移动端；视觉 QA 截图矩阵按 drilling/icebreaker 先例入库 `artifacts/qa/simulation-scene/rollout-dredger/`。

## Risks

- **chaseSideOffset 退役的取景差异**：跟船默认取景从横向偏移回到标准舰艉方向，属系列统一（六实验同口径），design §2 记录。
- **TargetMarker 默认关闭的任务流影响**：目标坐标在面板完整可读，drilling 同例已验收。
- **ref 直读采样器与 React 渲染节奏**：useFrame 内读 ref，与管线帧循环同拍（drilling 同构已验证）。
