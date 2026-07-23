## Context

平台 7 个船舶仿真实验已是 R3F 3D 场景（three 0.184 + @react-three/fiber 9.6.1 + drei 10.7.7），但视觉层停留在"无后处理、正弦海面、贴片云、DOM 仪表"的水平。Remotion 视频项目持有成套可移植视觉资产（尾迹粒子场、相机导演、环境预设），其 `scenario/` 目录为仅依赖 three Vector3 的纯 TS 数学层。本变更在 destroyer 样板上建立共享场景视觉管线，为后续 6 个实验的串行推广定管线与参数化范式。

约束真源：`docs/Simulation_Guidelines.md`（数值模型统一进 Rust/WASM，前端只保留固定步长调度、UI、图表、埋点）、`docs/grill/virtual-simulation/`（访谈词汇表与 4 份 ADR）、`artifacts/product-design-audits/virtual-simulation-2026-06-13/design-handoff.md`（指挥甲板构图与"不要变成游戏 HUD"——本变更将游戏感限定在场景本体，不触及该非目标）。

## Decisions

### 1. 共享模块层 `src/resources/simulations/scene/`

管线按职责分模块：`water/`（Gerstner 海面）、`wake/`（尾迹粒子场）、`environment/`（5 套预设 + 光照/雾）、`camera/`（自由 + 预设镜头）、`audio/`（音景总线）、`quality/`（质量分级）、`annotations/`（教学标注件）、`post/`（后处理链）。所有模块以 ship profile（船长、Froude 语义、GLB 路径、水线、尾迹发射锚点）注入，**任何模块不含实验硬编码**；destroyer 通过 `profiles/destroyer-055.ts` 扩展的视觉段接入。这是用户的硬性架构要求，也是后续 6 个实验零改写推广的前提。

### 2. 尾迹实时化移植

Remotion 实现是每帧按历史轨迹全量重建 ≤2200 个拉伸 quad 的 BufferGeometry（`ShipHeadingScene.tsx:1695-1922`），离线渲染无所谓 GC，实时 60fps 不可接受。移植时：

- 保留 `scenario/wakePhysics.ts` 的 Froude 数三路活跃度（wakeActivity/foamActivity/kelvinActivity）与四族粒子预算、确定性 hash 噪声（无闪烁、可重放，属于 `simulation-runtime-replayability` 豁免的视觉专用随机性）；
- 将"每帧全量重建"改为**环形缓冲增量更新**：每帧把船尾/左右肩锚点（`scenario/shipFrame.ts` 的 wakeOrigin/portShoulder/starboardShoulder 概念）追加进历史缓冲，发射新粒子、按 lifetime 淘汰，仅更新 position/color 属性并置 `needsUpdate`；
- 实时场景不再需要"历史回溯采样"：船由仿真驱动，轨迹由管线自行记录；
- 材质保持 `meshBasicMaterial` + Canvas alphaMap + vertexColors + 加法混合，无 shader 兼容风险。

### 3. 海面：Gerstner 几何涌浪

参照（《战舰世界》）的核心签名是几何涌浪起伏与波峰泡沫，Remotion 的法线贴图三层叠加（无顶点位移）不足以对标。升级为 GPU Gerstner 波（vertex shader 位移 + fragment 波峰泡沫 + 菲涅尔），在现有自定义 shader 海面（`wave-water.tsx`）的位置上替换；波分量数随质量档位缩放。船体纵摇/横摇语义保持现状（视觉级不新增船-浪耦合，避免触碰教学演示语义）。

### 4. 相机：停留语义 + 预设镜头

- 停留语义：交互结束后不主动回拉；各视角偏移跨模式切换保留（删除 `shouldResetPresetOffset` 的 free→预设清零）；target 不强制锁船——跟船平移保持用户相对取景。现状两处弹回机制（`camera-controller.tsx:172-174`、`:451-467`）随管线相机模块取代旧控制器而根除，不重写补丁。
- 自由视角：OrbitControls `enableDamping` 阻尼手感。
- 预设镜头：移植 `scenario/cameraTimeline.ts` 的跟船/环绕/退却/顶视/屏幕构图反解等模式子集，镜头间四元数 slerp 平滑过渡；从底部 `CameraViewSwitcher` 触发，与自由视角无缝互切。

### 5. 环境预设与主题边界

5 套预设（开阔海、薄雾黎明、暖色日落、阴云、风暴蓝）照搬 `environmentPresets.ts` 参数与贴图资产，场景内切换器手动选择；场景本体与平台明暗主题脱钩（ADR `20260723-decouple-simulation-scene-from-platform-theme.md`）。面板、HUD、网格、标签等 chrome 元素仍按主题换参——这是 `simulation-scene-shell-architecture` MODIFIED delta 的落点。

### 6. 质量分级与性能底线

底线：主流集显（近 4 年 Iris Xe / Apple M 系同级）1080p 稳 60fps。三档质量：high（全后处理 + 2200 粒子 + 全细分水面）、medium（半粒子 + 精简后处理）、low（无后处理 + 1/4 粒子 + 低细分）；启动时按设备探测默认档位，持续帧时间超预算自动降档，学生可手动覆盖。Playwright 性能 spec 断言帧时间预算与降档行为。

### 7. 资产压缩与渐进加载

7 个 GLB（11–32MB）在构建链路做 Draco/meshopt 重编码（外观不变，不触碰"不重新生成模型"禁区）；加载顺序：先出海面/天空/环境（轻资产），船模带进度条就位，取代纯文本占位。

### 8. 音景

WebAudio 总线模块，环境声（海浪/风，随环境预设联动）+ 操作反馈音 + 告警音；偏好默认开启，受 Autoplay Policy 约束在首次用户手势后解锁；场景内一键静音并持久化偏好。素材来源（免版税库或程序合成）在实现期裁决并记录。

### 9. 移植边界

从 `/Users/YW/Documents/Project/Videos` 复制资产到 `public/assets/simulation-scene/`（贴图、环境图、manifest）；`scenario/` 纯 TS 层改写为 `scene/` 模块：去耦合点仅四处——`useRemotionAsset`→普通 loader、`staticFile`→public URL、`useCurrentFrame`→时钟 ref、`ThreeCanvas`→R3F `<Canvas>`。相机 `CameraRig`/`OceanPlane` 内直连 `useCurrentFrame` 的双时间源问题在移植时统一为单一时钟。

### 10. 验证与遗留边界

验证链：源断言 vitest（注册/契约/门控）+ Playwright 性能 spec（帧时间、粒子预算、降档）+ 浏览器视觉 QA（对照参照出截图证据，1440×900 与 390×844）；不建像素基线。遗留单体 `src/resources/simulations/destroyer-simulation.tsx`（2736 行旧版，仅被回归测试当文本读取）不动；`physics/controllers|disturbances` 的 TS 残留不扩散、不复制到页面；cruise 页面几何偏差不在本变更（推广顺位处理）。

## Risks

- **GLB 压缩兼容性**：Draco/meshopt 需配套 decoder 进构建与运行时；若某个模型压缩后渲染异常，回退该模型为未压缩版本并记录。
- **实时尾迹预算**：2200 粒子的环形缓冲在集显上仍需实测；预算参数按档位下调，性能 spec 兜底。
- **参照主观性**：观感参照为唯一验收锚，视觉 QA 结论以截图对照矩阵留存证据，减少争议面。
- **音景素材**：素材未定时先用程序合成占位，不阻塞管线其余部分验收。
