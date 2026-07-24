## Context

管线八模块与七个实验接入已归档（`openspec/specs/simulation-scene-visual-pipeline/`）。本次为视觉控制层收口，全部决策已在 grill 访谈中钉死（词汇表 + 3 篇 ADR），本文件只把决策映射到模块与文件。

约束真源：`docs/grill/virtual-simulation/`（含新 ADR：chrome 家族、视图语义、音效双通道）、现行能力 spec、`docs/Simulation_Guidelines.md`。

## Decisions

### 1. 底部 chrome 家族（新共享组件，scene chrome 层）

- 新增统一形态基元 `ChromePopoverButton`（图标+两字、点击向上展开、按钮显示当前态、再点或选后收起、tooltip 承载功能+当前状态）。tooltip 用 `@radix-ui/react-tooltip`（已授权），封装为场景级 `SceneTooltip`，不让各按钮散落依赖细节。
- 六枚控件在底部工具条**整体一排**（不再分散于 bottom-32 四角）：**视图**（弹出层列跟船/战术/环绕/顶视/自由）、**环境**（五预设）、**画质**（高/中/低，按钮显示当前生效档与自动态，如「自动·高」）、**速率**（弹出 ± 调节条与当前倍率）、**音效**（弹出场景/界面双开关）、**标注**（网格与教学标注两行独立开关的合并弹出控件）。
- 挂载：`CameraViewSwitcher` 作为唯一底部工具条承载全部六枚控件；七个实验不再单独挂载 bottom-32 散放开关。
- 本地工具模板（`simulation-local-tools.tsx`）的占位命令条（`commands` 渲染段）整段移除；`commands` 字段从模板配置删除。
- 提示条（同文件 hint strip）加右上角关闭按钮，组件内 useState 控制，每次进入页面重新显示（不持久化）。

### 2. 视图语义与交互模型（scene/camera）

- `SCENE_CAMERA_SHOTS` 重定义：chase=正后方 45° 俯、1.8L；tactical（新 id，取代 retreat）=右后 45° 方位、45° 俯、2.0L；orbit=45° 俯、2.2L、自动圆周（60s/圈、俯视顺时针）；topDown 不变。
- 环绕动画：相机控制器在 orbit 激活时按固定角速度推进方位角；左键拖拽按 StayPut 暂停动画并捕获偏移；再次点击「环绕」复位重启轨道。
- 交互模型落实：左键拖拽=以船为中心的方位/俯仰偏移（StayPut 既有 offset 捕获保留）；右键=自由视角（既有 RightClickFreeModeBridge 保留）；视图按钮点击=锁定该视图；再次点击当前视图=复位标准机位（新增行为，spec 场景钉死）。
- 视图选择 UI 从平铺按钮改为视图弹出按钮（当前视图名+图标）；`'free'` 视图作为弹出层一项保留。

### 3. 音效双通道（scene/audio）

- `SoundscapeState` 拆为 `sceneEnabled`（环境声+告警）与 `uiEnabled`（按钮点击）两通道；`useSceneSoundscape` 兼容旧 `muted` 语义映射（两通道均关=muted）。
- 界面音效：底部 chrome 点击音 + 控制面板按钮点击音；「开始」按钮使用专属音效（与普通点击不同素材）。
- 默认与持久化：新用户双通道默认关；localStorage 分通道持久化；音频解锁仍受首次手势约束。
- 音效按钮：弹出层两个独立开关行（场景/界面），按钮图标按"任一开启/全部关闭"可变。
- 素材：沿用既有程序合成/库内素材（C1 音景链），界面点击音与开始音为新增素材选择（实现时从既有库选，不引入新依赖）。

### 4. 贴水折线（新增 scene/lines）

- `WaterHuggingLine`：输入顶点序列，逐点采样 `computeGerstnerDisplacement`（与 WakeTrailRig 同一 Gerstner 波组与质量档）得波面高度 +epsilon（0.3m），`useFrame` 更新位置缓冲；低档降采样（抽稀顶点或隔帧更新）。
- 迁移：六个实验的 TrajectoryLine/TrailLine、cruise 的 DesiredRouteLine 统一替换；annotations 模块的 ActualPathTrail 同步走贴水（管线内统一，不让实验各自实现）。

### 5. destroyer 航向修复（实验 glue）

- `destroyer-simulation.tsx` 两处（WakeTrailRig 的 `transformRef.current.heading`、StayPutCameraController 的 `headingSampler`）改经 `platformHeadingToSceneRad`；新增 destroyer 契约断言（与六个推广实验同构的接线断言+负断言）。顺带验证其旧三镜头几何恢复（并入 QA 矩阵）。

### 6. 面板形态（simulation-ui.tsx）

- `statusPanelPosition`/`controlPanelPosition`：移除桌面 `lg:bottom-24` 拉伸，改 `lg:bottom-auto` 自然高度；`dockBody` 的 `max-h-[calc(100vh-11.5rem)]` 封顶保留（超出内部滚动）。
- 卡片宽度：dock 内容区统一 `w-full` 约定，各实验卡片不再收窄（实验内卡片宽度约束统一移除）。

### 7. 验证

- 契约测试：chrome 家族形态（五弹出钮+标注钮+tooltip 挂载）、镜头几何参数表（45° 家族/距离倍率）、环绕动画语义、视图交互（再点复位）、音效双通道默认关+持久化、贴水折线采样语义、destroyer 接线断言、命令条与网格归属。
- Playwright：七路由冒烟适配新 chrome 选择器（弹出按钮可见可点开）；cruise×lng 几何一致性复跑（命令条移除后的高度变化双侧同构）；帧时间契约不变。
- 浏览器 QA（3003）：跟船/战术/环绕/顶视四机位几何、环绕动画与拖拽暂停、再点复位、五弹出钮+tooltip、音效双通道开关、贴水航迹随浪、提示条关闭、面板自适应、移动端、destroyer 修复对照（修复前后各一）——矩阵入库 `artifacts/qa/simulation-scene/unify-chrome/`。

## Risks

- **tooltip 新依赖**：已授权（ADR）；封装为 SceneTooltip 单点依赖，禁止组件内直引。
- **环绕为唯一持续运动机位**：角速度极小（60s/圈），拖拽即停，评测与遥测不感知（呈现层）。
- **选择器兼容**：Playwright/契约测试大量引用旧 chrome 选择器（data-scene-quality-select 等）——新组件保留全部 data-* 钩子名称（按钮化后属性名不变，值语义不变），测试只改交互路径（点开弹出层）不改断言语义。
- **destroyer 镜头几何变化**：旧三镜头本就镜像 90°，修复后取景跳变是"回到正确"而非回归（QA 对照证据）。
- **dock 高度变化**：双侧同构移除拉伸，cruise×lng 几何断言复跑兜底。
