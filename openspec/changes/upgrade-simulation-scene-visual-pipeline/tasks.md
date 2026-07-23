# Tasks: upgrade-simulation-scene-visual-pipeline

## 1. 管线骨架与新依赖

- [ ] 1.1 引入 `@react-three/postprocessing`（及逐一裁决的必要依赖），更新 `package.json` 与锁文件；typecheck 零错误。
- [ ] 1.2 建立 `src/resources/simulations/scene/` 模块骨架（water、wake、environment、camera、audio、quality、annotations、post）与 ship profile 视觉段类型；源断言：模块内不得出现实验 id 硬编码。
- [ ] 1.3 从 Remotion 项目复制资产到 `public/assets/simulation-scene/`（水面/尾迹/接触阴影贴图、5 套天空/云/地平线、manifest）；源断言：manifest 与文件一一对应。

## 2. 海面与尾迹

- [ ] 2.1 先写失败测试：Gerstner 波参数契约（分量数随档位缩放、波峰泡沫阈值、菲涅尔强度）与水面模块的公开接口。
- [ ] 2.2 实现 GPU Gerstner 海面模块并替换 destroyer 的旧正弦海面挂载。
- [ ] 2.3 先写失败测试：尾迹物理（Froude 三路活跃度、四族预算、确定性 hash 噪声同种子同结果）与环形缓冲（发射/淘汰/属性更新）契约。
- [ ] 2.4 移植 `wakePhysics`/`shipFrame` 语义，实现环形缓冲尾迹粒子场（开尔文臂、加法混合、Canvas alphaMap）；源断言：无 Remotion 导入残留。
- [ ] 2.5 destroyer 场景接入尾迹（替换旧 drei `Line` 艉迹），航速变化时活跃度响应正确。

## 3. 环境预设与光照

- [ ] 3.1 移植 5 套环境预设（天空/地平线/云/光照/雾参数与贴图）为 `environment/` 模块，场景内切换器手动切换。
- [ ] 3.2 测试：切换预设只改场景本体参数；平台明暗主题切换不改变场景本体（面板仍随主题）。

## 4. 相机系统

- [ ] 4.1 先写失败测试：停留语义——拖动释放后无回拉、free→预设→返回保留偏移、target 不强制锁船（跟船平移保持相对取景）。
- [ ] 4.2 实现管线相机模块（OrbitControls 阻尼 + 偏移记忆），取代 destroyer 的 `camera-controller.tsx` 挂载。
- [ ] 4.3 移植预设镜头模式子集（跟船/环绕/退却/顶视/屏幕构图），镜头间 slerp 平滑过渡，接入 `CameraViewSwitcher`。

## 5. 音景

- [ ] 5.1 实现 WebAudio 总线：环境声随环境预设联动、操作反馈音、告警音；偏好默认开启，首次用户手势解锁，一键静音并持久化。
- [ ] 5.2 测试：未手势前不出声、解锁后按预设出声、静音持久化生效；素材未定前用程序合成占位。

## 6. 教学标注

- [ ] 6.1 移植并优化标注件（实际航迹线默认开启；航向弧线/目标航线/方向箭头/世界标签进"教学标注"开关，默认关闭），显示效果与写实场景协调。
- [ ] 6.2 测试：默认仅航迹线可见；开关切换其余标注显隐。

## 7. 质量分级与加载

- [ ] 7.1 实现三档质量分级（后处理/粒子数/阴影/水面细分），启动探测默认档 + 帧时间超预算自动降档 + 手动覆盖。
- [ ] 7.2 GLB Draco/meshopt 压缩进构建链路，decoder 接入运行时；异常模型回退未压缩并记录。
- [ ] 7.3 渐进加载：先海面/环境后船模（带进度），取代文本占位。

## 8. destroyer 集成与面板边界

- [ ] 8.1 destroyer 全量接入管线（海面/尾迹/环境/相机/音景/标注/后处理/质量分级/渐进加载），面板与 Dock 结构、评估语义、控制器算法零改动。
- [ ] 8.2 源断言：驱动链文件（SimulationClock、facade、engine-factory、rust/）diff 为空；无新增 TS stepper/积分器。

## 9. 验证与验收

- [ ] 9.1 Playwright 性能 spec：集显档 1080p 帧时间预算、粒子预算、降档行为断言通过。
- [ ] 9.2 浏览器视觉 QA：1440×900 与 390×844 截图矩阵（海面/尾迹/环境预设×5/相机镜头/标注显隐/加载过程），对照《战舰世界》参照留存证据。
- [ ] 9.3 `rtk npm run typecheck` 零错误、相关测试套件通过、`rtk openspec validate upgrade-simulation-scene-visual-pipeline --type change --strict` 通过。
- [ ] 9.4 独立审查清场：范围限本变更 diff 与验收条件，finding 按 ACCEPT/REJECT/DEFER 裁决。
