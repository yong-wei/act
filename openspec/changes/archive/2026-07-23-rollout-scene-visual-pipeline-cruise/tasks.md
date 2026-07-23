# Tasks: rollout-scene-visual-pipeline-cruise

## 1. 档案与提案

- [x] 1.1 新增 `profiles/cruise-adora-scene.ts`：SceneShipVisualProfile（323.6m/18kn/模型 URL/尾迹锚点）；提案、design、tasks 与 spec delta 齐备并通过 validate --strict。

## 2. cruise 集成

- [x] 2.1 先写失败测试：cruise 集成标记断言（EnvironmentScene/GerstnerWater/WakeTrail/StayPutCameraController/providers/ScenePostEffects/QA 属性、无 UnifiedCameraController 与 MaritimeEnvironment、HeadingIndicator 在 toggle 内、DesiredRouteLine 保留常驻）与档案契约、航向适配器接线断言。
- [x] 2.2 Scene 组合替换：EnvironmentScene+CruiseWater 替换 MaritimeEnvironment 与旧灯；WakeTrailRig 新增（worldSpeedSampler=state.speed、resetToken=resetCount、key 重挂载）；StayPutCameraController 替换 UnifiedCameraController（headingSampler 经 platformHeadingToSceneRad）；CameraViewSwitcher views prop。
- [x] 2.3 provider 与 chrome：四个 provider 包裹主组件（嵌入课程模式同构）；预设切换器/静音/教学标注/档位选择挂载；SceneQualityAttributes。
- [x] 2.4 船模链路：meshopt 优先 + ErrorBoundary 回退 + frustumCulled=false；preload 仅压缩件。
- [x] 2.5 标注归一：TrajectoryLine 与 DesiredRouteLine 保留常驻；HeadingIndicator 移入教学标注 toggle（默认关闭）。

## 3. 验证与验收

- [x] 3.1 `rtk npm run typecheck` 零错误；`rtk openspec validate rollout-scene-visual-pipeline-cruise --type change --strict` 通过；vitest 相关套件通过。
- [ ] 3.2 Playwright：cruise 路由冒烟（canvas、质量属性、预设切换器、帧时间灾难上限）+ cruise 与 lng 场景容器几何一致性断言通过。
- [x] 3.3 浏览器 QA：cruise 跟船/顶视可见、尾迹位于舰艉沿航迹、五套预设、档位、标注开关、期望航线常驻、390×844 移动端、与 lng 同视口几何对照一致。
- [x] 3.4 独立审查清场：范围限本变更 diff 与验收条件，finding 按 ACCEPT/REJECT/DEFER 裁决。
