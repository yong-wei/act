## Context

样板（destroyer）已交付共享管线：water/wake/environment/camera/audio/quality/annotations/post 八个模块 + ship profile 参数化 + meshopt 压缩链 + 质量分级。lng 是管线的第二个消费方，也是"模块不含实验硬编码"的首次实证。lng 现状：使用共享 `MaritimeEnvironment`（正弦海面）、无艉迹、UnifiedCameraController（存在弹回机制）、模型原始 14.9MB GLB、React state 逐帧更新。

约束真源：`docs/Simulation_Guidelines.md`、`docs/grill/virtual-simulation/`、已归档 `simulation-scene-visual-pipeline` 能力 spec。

## Decisions

### 1. 集成映射（lng 旧件 → 管线）

- `MaritimeEnvironment` + `ambientLight`/`directionalLight` → `<Suspense fallback={null}><EnvironmentScene /></Suspense>`（雾/光照/天空/地平线/云全部由预设驱动）。
- 海面 → `<Suspense fallback={null}><PresetWater /></Suspense>`：GerstnerWater 颜色从当前预设 `water` 组取（桥接组件读 `useEnvironmentWaterColors` + `useSceneQuality` 档位）。
- 无艉迹 → `<WakeTrailRig>`：桥接 `shipTransform`（`state.position` + `toRadians(state.heading)` 的稳定引用对象）、`worldSpeedSampler={() => state.speed}`、`waterYSampler`（Gerstner CPU 采样）、`key={resetToken}` 随重置重挂载。lng 没有现成 resetToken——以既有 `handleReset` 的 `time: 0` 重置为令牌源（`resetCount` state）。
- `UnifiedCameraController` → `<StayPutCameraController>`：停留语义；`CameraViewSwitcher` 加 `views` prop（与样板同一组四个镜头）。
- 后处理 `<ScenePostEffects />`；`SceneQualityAttributes` QA 钩子；SceneQualityDriver。
- 灯光删除：旧 `ambientLight`/`directionalLight` 由 EnvironmentScene 的 hemisphere/sun/fill 替代。

### 2. 教学标注归一

- `TrajectoryLine` 保留为实际航迹线（默认常驻，样式留待推广期统一）。
- `HeadingIndicator`（当前/目标航向显示）移入 `TeachingAnnotationsToggle` 门控（默认关闭）；它是"航向弧线/目标航线"的 lng 等价物，语义上属于标注层。

### 3. 船模与档案

- 新增 `profiles/lng-changheng-scene.ts`：`SceneShipVisualProfile`（shipLengthMeters 295、designSpeedKnots 19、modelUrl `/assets/models-opt/Lng-carrier.glb`、waterlineY 0、尾迹锚点按 295×46.4m 船型估算）。
- 模型加载走样板的 meshopt 优先 + `ModelAssetErrorBoundary` 回退原始 GLB；meshopt 量化解码包围球误剔除同样板以 `frustumCulled=false` 处理（仅此一项；其余模型逻辑不动）。
- `useGLTF.preload` 仅压缩件（避免双份下载，样板 P2 修复口径）。

### 4. 状态消费模式

lng 以 React state 逐帧更新（既有模式，不动）。采样器从 `state` 读取即可（随渲染新鲜）；需要稳定引用对象的 `shipTransform` 用 `useRef` 镜像（WakeTrailRig 桥接内维护），避免把 React state 直接当 ref 使用。

### 5. 验证

- 源断言：lng 集成标记（EnvironmentScene/PresetWater/WakeTrail/StayPutCameraController/providers/ScenePostEffects/quality 属性）、无 UnifiedCameraController、HeadingIndicator 在 toggle 内、lng 档案契约、重置/航速语义。
- Playwright：lng 路由冒烟（canvas + 质量属性 + 预设切换器 + 帧时间灾难上限）。
- 浏览器 QA：lng 跟船/顶视可见、尾迹随速、预设切换、档位、移动端。

## Risks

- **React state 逐帧重渲染与管线帧循环的相互作用**：lng 既有模式（不动），管线组件按 props 随渲染更新即可；若 QA 发现掉帧可归因，再评估 state 订阅化（超出本变更）。
- **HeadingIndicator 进开关的语义变化**：默认关闭属访谈裁决（默认精简）；教师如需可随时打开，spec scenario 覆盖。
- **lng 水色预设**：五个预设的水色按通用海况设计，lng 不做专属调色（与样板同口径）。
