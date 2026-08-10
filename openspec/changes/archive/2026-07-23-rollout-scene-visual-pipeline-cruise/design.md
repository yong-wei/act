## Context

样板（destroyer）已交付共享管线，lng 与 container 已完成零模块改动复用并沉淀 `scene/heading.ts` 航向约定适配器。cruise 是系列中最复杂的消费方：组件约 2200 行，含遥测桥、AI 伴学、课程模式（嵌入单元课）与 Arena 黑箱提交面板（`src/app/simulations/cruise/page.tsx`，本变更不动）。cruise 现状：`MaritimeEnvironment`（seaState 联动）、无艉迹、`UnifiedCameraController`、模型原始 GLB（models-opt 压缩件已在位）、React state 逐帧更新、自有 `DesiredRouteLine`（期望航线）与 `HeadingIndicator`。

几何偏差：2026-06-15 审计记录 cruise 场景约 984×1362、其余仿真约 1320×930，源于当时 shell 的 workspaceSlots 渲染路径。当前 `SimulationShell`（`simulation-shell.tsx:88-95`）把结构化槽位（contextStrip/commandBar/supportDrawer/evidenceRail）渲染在场景框架**之后**，不再改变场景框架布局；1440×900 与 500×844 两档实测 cruise 与 lng 的 `[data-sim-ui]` 尺寸完全一致（1303×740 / 451×560）。

约束真源：`docs/Simulation_Guidelines.md`、`docs/grill/virtual-simulation/`、已归档能力 spec、`scene/heading.ts` 约定注释。

## Decisions

### 1. 集成映射（cruise 旧件 → 管线）

- `MaritimeEnvironment` + `ambientLight`/`directionalLight` → `<Suspense fallback={null}><EnvironmentScene /></Suspense>` + `<CruiseWater state={state} />`（GerstnerWater + useEnvironmentWaterColors + useSceneQuality，lng/container 同构）。
- 无艉迹 → `<WakeTrailRig>`：`platformHeadingToSceneRad(state.heading)` 适配、`worldSpeedSampler={() => state.speed}`、Gerstner waterY 采样、`key={resetToken}`（新增 `resetCount` state，`handleReset` 自增）。
- `UnifiedCameraController` → `<StayPutCameraController>`（headingSampler 经适配器；shipLength 取档案 323.6）；`CameraViewSwitcher` 加 `views` prop。
- 后处理 `<ScenePostEffects />`；`SceneQualityAttributes`；SoundscapeAmbienceDriver + SceneQualityDriver。
- 删除旧灯。cruise 的 `VisualizationLayer` 自带 `<Canvas>`（与其他实验不同），管线组件直接挂进该 Canvas；providers 包在主组件最外层（Context 跨 R3F 渲染器桥接，与 lng/container 同一机制）。

### 2. 教学标注归一与 cruise 特有元素

- `TrajectoryLine`（实际航迹）常驻；`DesiredRouteLine`（期望航线）常驻——它是 PID 控制目标的直接可视化，与轨迹线同类（lng 无对应物，container 的 WindIndicator 常驻同例）。
- `HeadingIndicator` 移入 `TeachingAnnotationsToggle` 门控（默认关闭）。

### 3. 海况视觉语义

- 旧 `MaritimeEnvironment` 的 `seaState`（含 virtualModeEnabled 时 `state.seaState`、否则 1）随组件退役；海面观感改由五套环境预设统一驱动。
- `seaState`/`waveDirection` 状态字段与控制面板保留——它们驱动横摇动力学（数值语义），不属于视觉层；学生可见的"海况"控制语义不变。

### 4. 嵌入课程模式

cruise 以 `isEmbedded` 嵌入课程页面（仅隐藏 TopBar）。管线与 chrome 在嵌入模式同样接入：视觉升级对课程页面与独立页面保持一致，不引入双轨观感。

### 5. 几何偏差闭环

- 现状判定：偏差源于旧 shell 路径，当前 shell 实测不重现（见 Context）。
- 防回归：Playwright 新增断言——cruise 路由 `[data-sim-ui]`  bounding box 与 lng 路由一致（容差 ±2px）。
- 页面结构化槽位（Arena 证据轨等）属面板结构边界，零改动。

### 6. 船模与档案

- 新增 `profiles/cruise-adora-scene.ts`：`SceneShipVisualProfile`（shipLengthMeters 323.6、designSpeedKnots 18（9.3 m/s ≈ 18.1 kn）、modelUrl `/assets/models-opt/luxury-liner.glb`、waterlineY 0、锚点按 323.6×37.2m 船型：stern [0,0,−161.8]、shoulders [±18.6,0,−97]）。
- meshopt 优先 + `ModelAssetErrorBoundary` 回退 + `frustumCulled=false`；preload 仅压缩件；模型自带 `rotation.y = -h + π/2` 轴向补偿保持不变。

### 7. 验证

- 源断言：cruise 集成标记（同 lng 断言组）+ DesiredRouteLine 保留 + 无 UnifiedCameraController/MaritimeEnvironment + 档案契约 + 重置/航速语义 + 航向适配接线断言。
- Playwright：cruise 路由冒烟 + 与 lng 的几何一致性断言。
- 浏览器 QA：跟船/顶视、尾迹舰艉沿航迹、五预设、档位、标注开关、期望航线常驻、移动端、与 lng 同视口几何对照。

## Risks

- **海况视觉语义变化**：海面观感从 seaState 数值联动变为预设驱动，属视觉层升级的统一裁决（与其他实验同口径）；动力学语义不变，design §3 记录。
- **嵌入模式 chrome 增加视觉元素**：与独立页面同构升级；若课程页面出现布局挤压，属后续统一 chrome 布局问题（超出本变更）。
- **组件体量大**：编辑面集中在 imports/模型/VisualizationLayer/主组件出口四区，遥测与课程逻辑零触碰。
