## Why

场景视觉管线已由 destroyer 样板与六个推广实验全量落地（PR #997–#1016）。本次在统一观感之上收口视觉控制层：底部视觉控制（视图、环境预设、画质、速率、音效、教学标注）目前是平铺文字 radio/文本按钮的混合形态，窄屏互相挤压（C6 期 Codex review 实证），且视图语义存在三处实质问题——跟船取景错误（低位正后方）、「退却」命名与机位语义不明、静态舷侧冒充环绕。同时处理五项关联缺陷：destroyer 样板期遗留的航向镜像（尾迹离舷 90°、旧三镜头同错，C2 记录 follow-up 经用户实证）、线状覆盖层被涌浪淹没、提示条不可关闭、本地工具模板的无行为占位命令条、面板拉伸留白。

决策真源：`docs/grill/virtual-simulation/`（词汇表 + 新增三篇 ADR：chrome 家族统一、视图语义重定义、音效双通道默认关闭）。

## What Changes

- **底部 chrome 家族统一**：视图/环境/画质/速率/音效五枚「图标+两字」弹出式按钮（点击向上展开、按钮只显示当前态、再点收起），教学标注为可变图标切换钮；网格开关并入视图弹出层；全部按钮以 `@radix-ui/react-tooltip` 提示功能与当前状态（新依赖，已授权）；本地工具模板的占位命令条（重置场景等无行为 span）移除。
- **视图语义重定义**：跟船=正后方上部 45°（1.8L）；「退却」更名「战术」=右后 45° 方位+45° 俯（2.0L）；环绕=45° 俯角自动圆周 60s/圈俯视顺时针（2.2L）；顶视不变。视图交互模型：左键以船为中心调角、松手角度保留且持续跟船；右键进自由视角；点击视图按钮锁定该视图、再点复位标准机位。
- **音效双通道**：场景（环境声+告警）与界面（按钮点击，含控制面板按钮；「开始」专属音效）独立开关，底部音效按钮弹出双通道控制；新用户默认关闭 + localStorage 分通道持久化（取代 C1 默认开启）。
- **贴水航迹**：管线新增贴水折线共享组件（顶点经 Gerstner CPU 采样贴合波面+epsilon，低档降采样），七个实验的 TrajectoryLine/TrailLine/DesiredRouteLine 统一迁移。
- **destroyer 缺陷修复**：`destroyer-simulation.tsx` 两处航向采样点经 `platformHeadingToSceneRad` 接线 + 契约断言（与其他六实验同构），修复尾迹离舷 90° 与旧三镜头镜像。
- **面板形态**：双侧 dock 改内容自然高度（保留 max-h 封顶滚动）、卡片 w-full 占满；提示条加右上角关闭按钮（每次进入显示）。
- 面板控制逻辑、评估语义、驱动链、SceneSpec/Trace 协议零改动；相机语义仍属呈现层。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `simulation-scene-visual-pipeline`：MODIFIED 视图镜头（语义重定义+交互模型场景）、音景（双通道+默认关闭）；ADDED 底部 chrome 家族形态、覆盖层贴水两条要求。

## Impact

- 共享模块改写：`scene/camera`（镜头定义+视图弹出层+交互模型）、`scene/annotations`（标注图标钮）、`scene/audio`（双通道+持久化+弹出层）、`scene/quality`（档位弹出钮）、`scene/environment`（预设弹出钮）、新增 `scene/lines`（贴水折线）、`components/camera-view-switcher`（速率弹出钮或并入家族）、`simulation-ui.tsx`（dock 高度/卡片）、`simulation-local-tools.tsx`（提示条关闭+命令条移除）。
- 七个实验：统一换用新 chrome 挂载（签名不变或极薄适配）+ 贴水折线替换各自折线；destroyer 额外两处航向修复。
- 测试：管线契约测试更新（镜头几何/交互/双通道/贴水/家族形态）、destroyer 修复断言、Playwright 冒烟适配新 chrome 选择器、几何一致性复跑；视觉 QA 矩阵按先例入库。
- 新依赖：`@radix-ui/react-tooltip`（ADR 已授权）。
- 显式非目标：不改驱动链、SceneSpec/Trace、面板控制逻辑、Arena 语义；不改五套环境预设内容；不做「记录观察/导出片段」真实链路（占位移除，未来单独立项）。
