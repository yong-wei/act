## Context

样板（destroyer）已交付共享管线，lng（PR #1002）已完成首次复用并沉淀 `scene/heading.ts` 航向约定适配器。container 是管线的第三个消费方。container 现状：使用共享 `MaritimeEnvironment`（seaState 3）、无艉迹、UnifiedCameraController（存在弹回机制）、模型原始 GLB（`/assets/container.glb`，models-opt 压缩件已在位）、React state 逐帧更新；实验自有 `WindIndicator`（风场指示）与负载率/横摇耦合显示。

约束真源：`docs/Simulation_Guidelines.md`、`docs/grill/virtual-simulation/`、已归档 `simulation-scene-visual-pipeline` 能力 spec、`scene/heading.ts` 约定注释。

## Decisions

### 1. 集成映射（container 旧件 → 管线）

- `MaritimeEnvironment` + `ambientLight`/`directionalLight` → `<Suspense fallback={null}><EnvironmentScene /></Suspense>`。
- 海面 → `<Suspense fallback={null}><PresetWater /></Suspense>`（桥接组件读 `useEnvironmentWaterColors` + `useSceneQuality` 档位）。
- 无艉迹 → `<WakeTrailRig>`：桥接 `shipTransform`（`state.position` + 经 `platformHeadingToSceneRad(state.heading)` 适配的稳定引用对象）、`worldSpeedSampler={() => state.speed}`、`waterYSampler`（Gerstner CPU 采样）、`key={resetToken}` 随重置重挂载。container 没有现成 resetToken——以既有 `handleReset` 为令牌源（`resetCount` state，lng 同模式）。
- `UnifiedCameraController` → `<StayPutCameraController>`：`headingSampler={() => platformHeadingToSceneRad(state.heading)}`；`CameraViewSwitcher` 加 `views` prop（与样板同一组四个镜头）。
- 后处理 `<ScenePostEffects />`；`SceneQualityAttributes` QA 钩子；SceneQualityDriver。
- 灯光删除：旧 `ambientLight`/`directionalLight` 由 EnvironmentScene 替代。

### 2. 教学标注归一

- `TrajectoryLine` 保留为实际航迹线（默认常驻）。
- `HeadingIndicator`（当前/目标航向）移入 `TeachingAnnotationsToggle` 门控（默认关闭），lng 同口径。
- `WindIndicator` 保留常驻：它是风场控制器（风速/风向滑块）的直接可视化反馈，属于实验仪器而非教学标注层；lng 无对应物，不影响归一性。

### 3. 船模与档案

- 新增 `profiles/container-msc-scene.ts`：`SceneShipVisualProfile`（shipLengthMeters 399.9、designSpeedKnots 20（10.3 m/s ≈ 20.0 kn）、modelUrl `/assets/models-opt/container.glb`、waterlineY 0、尾迹锚点按 399.9×61.5m 船型估算：stern [0,0,−199.95]、port/starboardShoulder [±30.75,0,−120]）。
- 模型加载走 meshopt 优先 + `ModelAssetErrorBoundary` 回退原始 GLB；量化包围球误剔除以 `frustumCulled=false` 处理（仅此一项；`rollAngle`/`loadRatio` 等既有模型逻辑不动，模型自带 `modelYawOffset=0` 的轴向补偿保持不变）。
- `useGLTF.preload` 仅压缩件。

### 4. 状态消费模式

container 以 React state 逐帧更新（既有模式，不动）。采样器从 `state` 读取；`shipTransform` 用 `useRef` 镜像（lng 同模式）。

### 5. 验证

- 源断言：container 集成标记（同 lng 断言组）、无 UnifiedCameraController、HeadingIndicator 在 toggle 内、WindIndicator 保留、container 档案契约、重置/航速语义、航向适配器接线断言（两处采样点经 `platformHeadingToSceneRad`，禁止裸 `toRadians`）。
- Playwright：container 路由冒烟（canvas + 质量属性 + 预设切换器 + 帧时间灾难上限）。
- 浏览器 QA：跟船/顶视可见、尾迹位于舰艉沿航迹、预设切换、档位、标注开关、移动端。

## Risks

- **React state 逐帧重渲染与管线帧循环的相互作用**：既有模式（不动），QA 发现掉帧可归因时再评估（超出本变更）。
- **WindIndicator 常驻的信息密度**：风场是本实验核心扰动变量，常驻为教学必需；若后续统一标注层再归并（超出本变更）。
- **锚点为估算值**：按船型尺度估算，QA 目测校正；不构成数值语义风险。
