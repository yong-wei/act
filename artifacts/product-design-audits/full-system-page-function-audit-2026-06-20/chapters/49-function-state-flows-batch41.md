# 功能状态流续篇（四十一）

日期：2026-06-20
基线：`dev1` 对齐 `origin/integration`，本地服务 `http://localhost:3100`
范围：全局 AppShell、共享浮动工具、Global AI 侧栏、主题切换、移动抽屉导航、焦点恢复和安全区策略。

## 1. 证据清单

- 截图目录：`../screenshots/76-function-state-flows-batch41/`
- Manifest：`../screenshots/function-state-flows-batch41-manifest.json`
- 采集脚本：`../scripts/capture-batch41.mjs`
- 结果：17 张 PNG、17 个 DOM/a11y JSON、26 个可选动作、0 个脚本错误、0 个忽略错误。

采集脚本先后使用固定学生、教师和管理员账号。第三次采集已修正脚本侧登录选择器和管理员密码，最终路由全部进入目标页面：

| 路由 | 最终 URL | 状态 |
|---|---|---:|
| `/dashboard` | `/dashboard` | 200 |
| `/knowledge?node=Bode图_1_1` | `/knowledge?node=Bode图_1_1` | 200 |
| `/teacher` | `/teacher` | 200 |
| `/admin/data-governance` | `/admin/data-governance` | 200 |
| `/arena` | `/arena` | 200 |
| `/assessment/adaptive-practice?goal=control-correction&intent=contextual-recommendation` | 同路径 | 200 |
| `/admin/users` | `/admin/users` | 200 |

## 2. 桌面壳层与浮动工具

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 1 | `/dashboard` | `01-student-dashboard-shell-default.png` | 学生驾驶舱有 `routeFrame=learning-atlas`、固定桌面导航和右下浮动入口；Tab 首项先进入隐藏/关闭态 AI 输入框。 |
| 2 | `/dashboard` 浮动工具展开 | `02-student-dashboard-floating-dock-open.png` | 面板展开后有主题切换和控灵 AI，但 `floatingPanelRole=""`。 |
| 3 | `/dashboard` AI 侧栏打开 | `03-student-dashboard-ai-sidebar-open.png` | 右侧 AI 覆盖层打开，`aiSidebarState=open`，但 `aiSidebarRole=""`；焦点可跳到浮动工具与页面正文。 |
| 4 | `/dashboard` AI 关闭后 | `04-student-dashboard-after-ai-close.png` | Escape 后焦点回到浮动入口，焦点恢复在该状态有效。 |
| 5 | `/dashboard` 主题切换 | `05-student-dashboard-theme-toggled.png` | 主题切换后页面视觉变化可见，但 `alerts=0`，没有完成/当前模式播报。 |
| 6 | `/knowledge?node=Bode图_1_1` 浮动工具展开 | `06-student-knowledge-floating-dock-inspector.png` | 知识图谱深链节点未解析，浮动面板仍无角色语义。 |
| 7 | `/knowledge?node=Bode图_1_1` AI 侧栏 | `07-student-knowledge-ai-sidebar-open.png` | AI 文案能说明“节点未解析”，但侧栏仍无区域语义。 |
| 8 | `/teacher` 浮动工具展开 | `08-teacher-dashboard-floating-dock-open.png` | 教师工作台沿用同一浮动面板；面板无角色语义，Tab 顺序从浮层跳回整页正文。 |
| 9 | `/admin/data-governance` 浮动工具展开 | `09-admin-data-governance-floating-dock-open.png` | 管理员治理页也沿用同一面板；刷新、治理状态和浮动工具之间缺少完成状态播报。 |

## 3. 移动壳层与跨角色状态

| 步骤 | 路径 | 证据 | 关键观察 |
|---:|---|---|---|
| 10 | `/arena` 移动默认 | `10-mobile-arena-drawer-default.png` | 竞技场移动路由为 `mobileNavigation=drawer`，默认抽屉关闭。 |
| 11 | `/arena` 移动抽屉打开 | `11-mobile-arena-drawer-open.png` | 抽屉有 `role=dialog` 和 `aria-modal=true`，焦点序列留在抽屉导航项内。 |
| 12 | `/assessment/adaptive-practice?...` 移动默认 | `12-mobile-adaptive-path-shell-default.png` | 学习路径移动页使用 `workspace-command-surface`，但 `adaptiveDockPolicy=""`。 |
| 13 | 同上，浮动工具展开 | `13-mobile-adaptive-path-floating-dock-open.png` | 浮动面板覆盖当前建议卡与路径摘要，且没有专属避让策略。 |
| 14 | `/dashboard` 移动 AI 打开 | `14-mobile-dashboard-ai-sidebar-open.png` | AI 在移动端占据首屏上部，但没有 dialog/complementary 语义；焦点仍可跳出侧栏。 |
| 15 | `/dashboard` 移动 AI 关闭后 | `15-mobile-dashboard-after-ai-close.png` | Escape 后焦点回到浮动入口，恢复路径有效。 |
| 16 | `/admin/users` 移动默认 | `16-mobile-admin-users-shell-default.png` | 管理员移动用户页没有 AppShell routeFrame 标记，但全局浮动入口仍出现；full-page PNG 宽度为 945px，说明窄屏存在横向溢出。 |
| 17 | `/admin/users` 移动浮动工具展开 | `17-mobile-admin-users-floating-dock-open.png` | 面板覆盖右下统计/操作区域，仍无角色语义和状态播报；截图同样为 945px 宽。 |

## 4. 主要问题

### 235. P1：浮动工具展开面板缺少弹出层语义

学生、教师、管理员、知识图谱和移动管理页的展开面板均显示 `floatingPanelOpen=true`，但 `floatingPanelRole=""`。按钮虽有 `aria-expanded`，面板本体没有 `menu`、`dialog`、`region` 或等价关系，读屏用户无法判断当前进入的是临时工具菜单还是页面内容的一部分。

建议：为 `data-platform-floating-dock-expanded-panel` 建立明确角色、标题和触发器关联。若按菜单处理，使用菜单语义和键盘方向键；若按工具面板处理，使用命名区域并约束 Tab 顺序。

### 236. P1：Global AI 侧栏缺少区域语义和焦点 containment

桌面和移动 AI 侧栏均为 `aiSidebarState=open` 且 `aiSidebarRole=""`。焦点序列显示关闭按钮、AI 输入框之后会跳到全局浮动入口和页面正文，说明侧栏不是受控 dialog，也不是命名 complementary 区域。

建议：移动端按 modal dialog 处理，桌面端至少提供 `role=complementary` 或命名区域，并根据打开方式决定是否启用焦点陷阱。Escape 关闭与返回焦点已部分有效，应保留。

### 237. P1：移动端学习路径浮动面板遮挡当前建议和路径摘要

`13-mobile-adaptive-path-floating-dock-open.png` 中，展开面板压在“当前建议”和路径摘要区域上；DOM 也显示 `adaptiveDockPolicy=""`。这与第四十批移动学习路径浮层干扰一致，说明页面级避让策略没有接入。

建议：学习路径页设置稳定的 `data-adaptive-path-dock-collision-policy`，或由 AppShell 根据 routeFrame 自动调整移动浮动工具位置，避免覆盖当前建议、路径节点、生成表单和主按钮。

### 238. P2：主题切换缺少当前模式和完成播报

学生桌面、教师桌面、管理员桌面和移动管理页均能触发主题切换，但截图与 DOM 摘要均为 `alerts=0`。切换后焦点甚至可能落到 `body`，读屏用户无法确认当前是浅色还是深色。

建议：主题切换按钮的可访问名称包含目标模式或当前模式，并在切换完成后更新 `role=status` 或 `aria-live=polite` 区域。

### 239. P2：全局 AI 输入框在关闭态过早进入 Tab 顺序

学生 dashboard、Arena 移动、学习路径移动和管理员移动页的焦点轨迹中，第一项经常是“全局 AI 问题输入框”，即使 `aiSidebarState=closed`。这会让键盘用户先进入不可见或非当前任务控件，再到浮动入口和正文。

建议：侧栏关闭时移除 AI 输入框的 Tab 可达性，或确保关闭态容器使用 `inert`/`aria-hidden` 与不可聚焦处理。

### 240. P2：移动 Arena 抽屉语义正确，但全局浮动入口仍在底部竞争

移动 Arena 抽屉已具备 `role=dialog` 和 `aria-modal=true`，焦点轨迹也留在抽屉项目内，这是本批的正向证据。但截图底部仍保留全局浮动入口命中点，视觉上与抽屉和 Arena 筛选区竞争。

建议：移动抽屉打开时隐藏或禁用全局浮动工具命中区，至少确保其不参与命中测试和读屏顺序。

### 241. P2：管理员和教师遗留壳层缺少 routeFrame 与导航策略标记

`/teacher`、`/admin/data-governance` 和 `/admin/users` 的 DOM 摘要中 `routeFrame`、`desktopNavigation`、`mobileNavigation` 为空，但全局浮动工具仍启用。这些页面无法被统一 safe-area、移动导航和状态策略识别。

建议：为教师和管理员遗留页补齐 AppShell frame 标记，或者建立桥接配置，使全局浮动工具按角色页类型应用相同碰撞、导航和可访问性规则。

### 242. P2：跨壳层状态变化仍缺少 live/status

17 个截图的 `alerts=0`。抽屉打开、浮动面板展开、AI 侧栏打开/关闭、主题切换、数据治理刷新上下文都没有可读状态区。本批与前几批的筛选、生成、提交、刷新缺状态播报问题同源。

建议：把全局 shell 交互接入统一状态播报层，至少覆盖“工具菜单已打开/关闭”“控灵已打开/关闭”“主题已切换为 X”“移动导航已打开/关闭”。

### 243. P2：管理员用户移动页存在横向溢出

`16-mobile-admin-users-shell-default.png` 和 `17-mobile-admin-users-floating-dock-open.png` 在 390px 移动 viewport 下导出为 945px 宽 full-page PNG，说明页面内容或表格强制撑宽了文档。用户会遇到横向滚动，浮动工具也会相对撑宽后的页面定位，而不是贴合可视安全区。

建议：管理员用户页移动端应把统计、筛选、导入和用户表格改为单列/卡片或可控横向表格容器，页面根宽度保持 viewport 宽度，避免全局浮动工具按溢出文档定位。

## 5. 后续审计输入

- 全局浮动工具和 AI 侧栏修复后，应优先回归学生 dashboard、移动学习路径、移动 Arena、教师工作台和管理员用户/治理页。
- 移动抽屉已有可用语义，可以作为后续全局浮层语义修复的参考实现。
- 下一批可继续沿用户使用顺序补“全局壳层修复前的角色页移动长任务”，或转向更深的 AI 侧栏对话、引用、上下文切换状态审计。
