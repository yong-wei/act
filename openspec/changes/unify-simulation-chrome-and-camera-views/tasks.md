# Tasks: unify-simulation-chrome-and-camera-views

## 1. 提案与依赖

- [ ] 1.1 提案、design、tasks 与 spec delta 齐备并通过 validate --strict；引入 `@radix-ui/react-tooltip`（已授权）并封装 `SceneTooltip` 单点依赖。

## 2. 底部 chrome 家族

- [ ] 2.1 先写失败测试：家族形态断言（视图/环境/画质/速率/音效五弹出钮、教学标注图标钮、tooltip 挂载、data-* 钩子保留、网格在视图弹出层内、命令条移除）。
- [ ] 2.2 `ChromePopoverButton` 基元 + 五枚弹出钮（视图/环境/画质/速率/音效）+ 教学标注图标钮实现。
- [ ] 2.3 七个实验底部 chrome 统一换用家族按钮；`CameraViewSwitcher` 视图/网格/速率职责迁移收敛。
- [ ] 2.4 本地工具模板：占位命令条整段移除；提示条加右上角关闭按钮（每次进入显示）。

## 3. 视图语义与交互模型

- [ ] 3.1 先写失败测试：镜头几何参数表（跟船正后 45°/1.8L、战术右后 45°/2.0L、环绕 45°/2.2L/60s 圈、顶视 3.2L）、再点复位、环绕拖拽暂停。
- [ ] 3.2 `SCENE_CAMERA_SHOTS` 重定义（tactical 取代 retreat）；环绕自动圆周动画与拖拽暂停；再点当前视图复位标准机位。
- [ ] 3.3 视图弹出按钮接入新镜头集（含自由视角项与网格开关项）。

## 4. 音效双通道

- [ ] 4.1 先写失败测试：双通道默认关、localStorage 分通道持久化、muted 兼容映射、音效按钮弹出双开关。
- [ ] 4.2 `SoundscapeState` 双通道化；界面音效接线（chrome 点击 + 控制面板按钮；「开始」专属音效）；音效按钮弹出层。

## 5. 贴水航迹与 destroyer 修复

- [ ] 5.1 先写失败测试：贴水折线采样语义（顶点经 Gerstner 采样+epsilon、低档降采样）、destroyer 两处航向接线断言（同其他六实验）。
- [ ] 5.2 新增 `scene/lines` 贴水折线组件；六个实验 TrajectoryLine/TrailLine、cruise DesiredRouteLine、annotations ActualPathTrail 统一迁移。
- [ ] 5.3 `destroyer-simulation.tsx` 两处航向采样点经 `platformHeadingToSceneRad` 修复。

## 6. 面板形态

- [ ] 6.1 双侧 dock 移除桌面拉伸改自然高度（保留 max-h 封顶滚动）；卡片 w-full。

## 7. 验证与验收

- [ ] 7.1 `rtk npm run typecheck` 零错误；`rtk openspec validate unify-simulation-chrome-and-camera-views --type change --strict` 通过；vitest 相关套件通过。
- [ ] 7.2 Playwright：七路由冒烟（新 chrome 弹出交互）、cruise×lng 几何一致性、帧时间契约通过。
- [ ] 7.3 浏览器 QA（3003）：四机位几何、环绕动画与拖拽暂停、再点复位、五弹出钮+tooltip、音效双通道、贴水航迹、提示条关闭、面板自适应、移动端、destroyer 修复对照；矩阵入库 `artifacts/qa/simulation-scene/unify-chrome/`。
- [ ] 7.4 独立审查清场：范围限本变更 diff 与验收条件，finding 按 ACCEPT/REJECT/DEFER 裁决。
