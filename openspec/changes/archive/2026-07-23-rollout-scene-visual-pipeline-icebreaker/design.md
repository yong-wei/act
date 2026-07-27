## Context

样板（destroyer）已交付共享管线，lng / container / cruise / drilling 已完成零模块改动复用。icebreaker 是第六个消费方。icebreaker 现状：`MaritimeEnvironment` + 冰区模式下叠加自定义 `IceOcean` shader（冰区减浪 0.2 阻尼、冷色偏移、浮冰斑块）、`UnifiedCameraController`、`HeadingIndicator`（目标航向）、`TrailLine`（实际航迹）、模型原始 GLB（models-opt 压缩件已在位）、React state 逐帧更新、模型自带 `rotation.y = -h + π/2` 轴向补偿与方位推进双吊舱视觉（azimuth1/2）。

约束真源：`docs/Simulation_Guidelines.md`、`docs/grill/virtual-simulation/`、已归档能力 spec、`scene/heading.ts` 约定注释。

## Decisions

### 1. 集成映射（icebreaker 旧件 → 管线）

- `MaritimeEnvironment` + `IceOcean` + 旧灯 → `<Suspense fallback={null}><EnvironmentScene /></Suspense>` + `<IcebreakerWater state={state} />`（GerstnerWater + useEnvironmentWaterColors + useSceneQuality，lng 同构）。
- 无艉迹 → `<WakeTrailRig>`：`platformHeadingToSceneRad(state.heading)` 适配、`worldSpeedSampler={() => state.speed}`、Gerstner waterY 采样、`key={resetToken}`（新增 `resetCount` state，`handleReset` 自增）。
- `UnifiedCameraController` → `<StayPutCameraController>`（headingSampler 经适配器；shipLength 取档案 122.5）；`CameraViewSwitcher` 加 `views` prop。
- 后处理 `<ScenePostEffects />`；`SceneQualityAttributes`；SoundscapeAmbienceDriver + SceneQualityDriver。
- 删除旧灯。`IceOcean` 组件与 shader 源码随挂载点删除一并移除（不再被引用）。

### 2. 冰区视觉语义

- `IceOcean` 的冰区视觉（减浪、冷色、浮冰斑块）随旧环境退役；冰区观感改由五套环境预设统一承载（与其他实验同口径，cruise 海况决策先例）。
- 冰区教学语义完整保留：`iceModeEnabled` 状态、冰厚、冰区安全等级面板（`IceStatusPanel`/`getIceZoneSafetyLevel`）、破冰动力学与破冰速度阈值全部不动。

### 3. 教学标注归一

- `TrailLine`（实际航迹）保留常驻。
- `HeadingIndicator`（目标航向）移入 `TeachingAnnotationsToggle` 门控（默认关闭）。

### 4. 船模与档案

- 新增 `profiles/icebreaker-xuelong-scene.ts`：`SceneShipVisualProfile`（shipLengthMeters 122.5、designSpeedKnots 15.5（开阔水域设计航速）、modelUrl `/assets/models-opt/icebreaker.glb`、waterlineY 0、锚点按 122.5×22m 船型：stern [0,0,−61.25]、shoulders [±11,0,−36.75]）。
- meshopt 优先 + `ModelAssetErrorBoundary` 回退 + `frustumCulled=false`；preload 仅压缩件；方位推进吊舱（azimuth1/2）与 `rotation.y = -h + π/2` 轴向补偿保持不变。

### 5. 验证

- 源断言：icebreaker 集成标记（同样板断言组）+ 无 UnifiedCameraController/MaritimeEnvironment/IceOcean + 档案契约 + 重置/航速语义 + 航向适配接线断言 + HeadingIndicator 门控 + TrailLine 常驻。
- Playwright：icebreaker 路由冒烟（默认档 chrome 断言 + 帧预算；若模型较重沿 drilling 先例低档验证）。
- 浏览器 QA：跟船/顶视可见、尾迹位于舰艉沿航迹、冰区模式面板正常、五预设、档位、标注开关、移动端；视觉 QA 截图矩阵按 drilling 先例入库 `artifacts/qa/simulation-scene/rollout-icebreaker/`。

## Risks

- **冰区视觉特征减弱**：浮冰斑块/冷色偏移是冰区氛围的直接视觉，退役后冰区语义由面板与状态数值承载；已按系列统一裁决（视觉语义进预设、教学语义进面板），design §2 记录。若后续认为冰区需要专属预设，属管线层新能力（另行立项）。
- **方位推进双吊舱为模型内视觉**：不接入管线参数，保持原样。
