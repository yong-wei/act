# Tasks: rollout-scene-visual-pipeline-dredger

## 1. 档案与提案

- [x] 1.1 新增 `profiles/dredger-tianjing-scene.ts`：SceneShipVisualProfile（127.5m/12kn/模型 URL/尾迹锚点）；提案、design、tasks 与 spec delta 齐备并通过 validate --strict。

## 2. dredger 集成

- [x] 2.1 先写失败测试：dredger 集成标记断言（EnvironmentScene/GerstnerWater/WakeTrail/StayPutCameraController/providers/ScenePostEffects/QA 属性、无 UnifiedCameraController 与 MaritimeEnvironment、TargetMarker 在 toggle 内、TrajectoryLine 常驻）与档案契约、速度模（Math.hypot）与航向适配器接线断言。
- [x] 2.2 Scene 组合替换：EnvironmentScene+DredgerWater 替换 MaritimeEnvironment 与旧灯；WakeTrailRig 新增（采样器直读 mmgStateRef、worldSpeedSampler=hypot(u,v)、resetToken=resetCount、key 重挂载）；StayPutCameraController 替换 UnifiedCameraController（chaseSideOffset 自定义随旧控制器退役）；CameraViewSwitcher views prop。
- [x] 2.3 provider 与 chrome：四个 provider 包裹；预设切换器/静音/教学标注/档位选择挂载；SceneQualityAttributes。
- [x] 2.4 船模链路：meshopt 优先 + ErrorBoundary 回退 + frustumCulled=false；preload 仅压缩件；模型轴向补偿按 QA 实证修正为 rotation.y=-heading（GLB 长轴为 X）；舵角视觉保持原样。
- [x] 2.5 标注归一：TrajectoryLine 保留常驻；TargetMarker 移入教学标注 toggle（默认关闭）。

## 3. 验证与验收

- [x] 3.1 `rtk npm run typecheck` 零错误；`rtk openspec validate rollout-scene-visual-pipeline-dredger --type change --strict` 通过；vitest 相关套件通过。
- [x] 3.2 Playwright：dredger 路由冒烟（canvas、质量属性、预设切换器、帧时间灾难上限）通过。
- [x] 3.3 浏览器 QA：dredger 跟船/顶视可见、作业/机动工况尾迹位于艉向、五套预设、档位、标注开关（TargetMarker 显隐）、390×844 移动端；截图矩阵入库 `artifacts/qa/simulation-scene/rollout-dredger/`。
- [x] 3.4 独立审查清场：范围限本变更 diff 与验收条件，finding 按 ACCEPT/REJECT/DEFER 裁决。
