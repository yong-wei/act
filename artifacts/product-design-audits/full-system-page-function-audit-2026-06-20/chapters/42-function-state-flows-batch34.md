# 功能状态流审计续篇（三十四）

日期：2026-06-20
基线：`dev1` 已对齐 `origin/integration`，HEAD `89a826ee53`。
范围：跨角色权限边界、用户菜单、改密弹窗、退出登录、全局浮动工具、主题切换、AI 侧栏和移动端壳层导航。
截图目录：`screenshots/69-function-state-flows-batch34/`
Manifest：`screenshots/function-state-flows-batch34-manifest.json`
本批新增截图：13 张，全部带 DOM/a11y JSON 快照；关键交互带 Tab 焦点路径。
账号：学生 `demo`，教师 `201300000012`，管理员 `admin`。

## 1. 本批审计顺序

1. 学生登录后直达 `/admin/users`，检查管理员权限边界。
2. 学生登录后直达 `/teacher`，检查教师权限边界。
3. 教师登录后直达 `/admin/data-governance`，检查管理员权限边界。
4. 管理员登录后直达 `/teacher`，检查教师权限边界。
5. 学生打开顶部用户菜单，检查菜单语义、焦点顺序和退出/改密入口。
6. 学生打开修改密码弹窗并空提交，检查弹窗语义、错误播报和焦点隔离。
7. 学生执行退出登录，检查回到登录态后的壳层状态。
8. 学生打开全局浮动工具菜单，检查工具菜单、主题和 AI 入口。
9. 学生切换主题，检查状态可发现性和完成播报。
10. 学生从全局工具打开 AI 侧栏，检查侧栏语义、焦点 containment 和关闭。
11. 学生用 Escape 关闭 AI 侧栏，检查焦点恢复。
12. 学生移动端打开 `/dashboard`，检查移动导航入口、全局浮层和首屏焦点。
13. 教师移动端打开 `/teacher`，检查移动导航入口、长页导航和全局浮层。

## 2. 跨角色权限边界

证据：

- `01-student-admin-boundary-desktop.png`
- `02-student-teacher-boundary-desktop.png`
- `03-teacher-admin-boundary-desktop.png`
- `04-admin-teacher-boundary-desktop.png`

API 证据：

- `/api/auth/session` 学生上下文返回 `role=STUDENT`，账号 `demo@example.com`。
- `/api/auth/session` 教师上下文返回 `role=TEACHER`，账号 `张永韡`。
- `/api/auth/session` 管理员上下文返回 `role=ADMIN`，账号 `admin`。

路由证据：

- 学生访问 `/admin/users`，最终落到 `/`，HTTP 记录为 200。
- 学生访问 `/teacher`，最终落到 `/dashboard`，HTTP 记录为 200。
- 教师访问 `/admin/data-governance`，最终落到 `/`，HTTP 记录为 200。
- 管理员访问 `/teacher`，最终落到 `/admin`，HTTP 记录为 200。

观察：

- 非授权角色访问其他工作台时没有明确“无权限”“角色不匹配”“返回我的工作台”的状态页。
- 多数边界以静默 307 后落到首页或对应角色工作台结束；Playwright 最终响应为 200，页面文本也没有权限解释。
- 管理员访问教师端后落回 `/admin`，但用户无法从界面知道刚才的教师端入口为何不可进入。
- 这些边界能保护页面，但缺少产品层解释、审计提示和下一步动作。

问题：

- P1：跨角色访问被静默重定向。用户看不到被拦截的目标、原因和正确去处。
- P1：权限边界缺少可审计状态。最终页面是 200 的正常工作台，客服、测试和日志外观都难以区分“成功访问工作台”和“权限拦截后回落”。
- P2：跨角色返回路径不一致。学生访问管理员落 `/`，学生访问教师落 `/dashboard`，教师访问管理员落 `/`，管理员访问教师落 `/admin`，缺少统一边界体验。

建议：

- 增加角色边界页或 toast/status：说明目标路径、当前角色、允许角色和返回动作。
- 保留服务端拦截，但在最终页面携带一次性边界提示，例如 `roleBoundary=admin-only`。
- 将跨角色边界统一为“解释 + 返回当前角色工作台 + 申请权限/切换账号”三件事。

## 3. 用户菜单与改密弹窗

证据：

- `05-student-user-menu-open-desktop.png`
- `06-student-password-empty-submit-desktop.png`
- `07-student-logout-redirect-desktop.png`

观察：

- 用户菜单视觉上展示“个人中心 / 修改密码 / 退出登录”，但菜单面板不是 `role=menu`，菜单项也没有对应 `menuitem` 语义。
- 打开用户菜单后的 Tab 顺序先走三项菜单，再直接进入背景页面的学习入口，菜单没有焦点边界和关闭策略。
- 修改密码弹窗视觉居中且有遮罩，但 DOM 没有 `role=dialog` 或 `aria-modal`。
- 空提交后错误文案“请输入当前密码与新密码”可见，但没有 `role=alert`、`role=status` 或 `aria-live`。
- 改密弹窗打开后继续按 Tab 会进入背景页面链接，焦点没有限制在弹窗内。
- 在 `NEXTAUTH_URL=http://localhost:3100` 与采集基准一致时，退出登录落到 `/login`，没有保留已登录壳层。

问题：

- P1：用户菜单缺少菜单语义和受控焦点。读屏用户难以识别当前是账户操作菜单，键盘用户会从菜单直接游离到背景任务。
- P1：修改密码弹窗缺少 dialog 语义和焦点隔离。Tab 会进入背景页面，弹窗不是一个可靠的模态流程。
- P1：改密错误缺少可访问播报。空提交错误只是一段普通文本，读屏用户无法稳定收到结果。
- P2：退出登录依赖运行基准 URL 一致性。本批已用匹配 `NEXTAUTH_URL` 重跑通过；若本地服务端口与 `.env` 不一致，退出会跳到错误端口。

建议：

- 用户菜单使用 menu/button 模式：触发按钮 `aria-haspopup=menu`，面板 `role=menu`，条目 `role=menuitem`，Escape 和外部点击关闭。
- 修改密码弹窗补 `role=dialog`、`aria-modal=true`、可访问标题，并把焦点限制在弹窗内部。
- 表单错误和成功消息统一进入 `role=alert` 或 `role=status`。
- 开发采集脚本启动服务时显式设置 `NEXTAUTH_URL`，避免把端口漂移误判成产品问题。

## 4. 全局浮动工具、主题与 AI 侧栏

证据：

- `08-dashboard-floating-dock-expanded-desktop.png`
- `09-dashboard-theme-toggle-state-desktop.png`
- `10-dashboard-ai-sidebar-open-desktop.png`
- `11-dashboard-ai-sidebar-esc-restore-desktop.png`

观察：

- 全局浮动工具能打开并显示“主题切换”和“控灵 AI助手”，主题切换后 `documentElement.className` 从 `light` 变为 `dark`。
- 浮动工具面板不是 menu/dialog/popover 语义，Tab 从工具项跳到 `body` 后又进入背景导航、主题按钮、用户菜单和学习入口。
- 主题切换没有 status/live 反馈；用户只能通过颜色变化和菜单中的“浅色/深色”字样推断结果。
- AI 侧栏打开后 `data-global-ai-sidebar="open"`，视觉上占据右侧，但没有 `role=dialog`、`role=complementary`、`aria-modal` 或明确 landmark。
- AI 侧栏打开后 Tab 路径为关闭按钮、输入框、浮动工具按钮、`body`、背景导航和用户菜单，焦点没有被限制在侧栏或可解释区域内。
- Escape 能关闭侧栏，但关闭后的第一个 Tab 进入 `body`，没有稳定恢复到触发 AI 的浮动工具按钮。

问题：

- P1：全局浮动工具菜单缺少弹出层语义和焦点边界。它承担全站工具入口，却没有可访问的菜单/弹出层结构。
- P2：主题切换缺少完成播报。视觉变化存在，但没有告诉键盘和读屏用户当前主题已切换。
- P1：AI 侧栏缺少区域语义和焦点 containment。侧栏看起来像模态/辅助面板，但键盘会进入背景页面。
- P1：AI 侧栏关闭后的焦点恢复不稳定。Escape 后焦点没有回到触发控件，后续 Tab 从 `body` 重新开始。

建议：

- 将全局工具面板建模为 `role=menu` 或带 `popover` 语义的工具层，并定义 Escape、Tab、Shift+Tab 行为。
- 主题切换写入 `role=status`，例如“已切换为深色模式”。
- AI 侧栏若是模态助手，应使用 dialog 模式并隔离背景；若是辅助区域，应使用 `aside role=complementary`、明确标题和可预期的焦点顺序。
- 关闭侧栏后把焦点恢复到触发 AI 的按钮，而不是 `body`。

## 5. 移动端壳层导航与全局浮层

证据：

- `12-student-mobile-navigation-drawer.png`
- `13-teacher-mobile-navigation-drawer.png`

观察：

- 学生移动端 `/dashboard` 没有找到“打开平台导航/导航”抽屉按钮；页面展示顶部横向导航和长内容列表。
- 教师移动端 `/teacher` 也没有找到可点击的抽屉按钮；页面直接展示横向/顶部导航和长工作台内容。
- 学生移动端首个 Tab 进入全局 AI 输入框，第二个 Tab 进入全局浮动工具，第三个 Tab 才回到 `body` 和页面主任务。
- 教师移动端首个 Tab 同样进入全局 AI 输入框和浮动工具，然后才进入返回首页、用户菜单和教师导航。
- 学生移动端截图中控灵浮层和黑色小按钮覆盖卡片区域；教师移动端长页中全局工具同样先于业务导航进入焦点路径。

问题：

- P1：移动端导航模式不一致且不可发现。代码已有 drawer 能力，但学生/教师主工作台没有稳定的抽屉入口或统一移动导航入口。
- P1：移动端全局 AI 先于页面主任务进入键盘路径。学生和教师都先进入 AI 输入框/浮动工具，再到业务导航和内容。
- P2：移动端全局浮层仍会压住内容卡片。截图能看到浮层贴近业务卡片，长页中缺少充分避让。

建议：

- 对学生、教师和管理员主工作台统一移动导航策略：顶部横向导航、抽屉导航或底部导航只能选一种主模式，并提供一致入口。
- 移动端默认不应让 AI 输入框先于页面主任务进入 Tab；全局助手可放到页面主内容之后或仅在打开后进入焦点流。
- 长页移动端为全局浮层预留真实安全区域，避免遮挡卡片、按钮和表单。

## 6. 本批新增优先问题

165. P1：跨角色访问被静默重定向。
     学生、教师和管理员访问非本角色工作台时最终落到 `/`、`/dashboard` 或 `/admin`，没有解释目标路径为何不可进入。

166. P1：权限边界缺少可审计状态。
     拦截后最终页面都是 200 的正常页面，界面上无法区分正常访问和权限回落。

167. P1：用户菜单缺少菜单语义和受控焦点。
     账户菜单不是 `role=menu`，Tab 会从菜单项直接进入背景学习入口。

168. P1：修改密码弹窗缺少 dialog 语义和焦点隔离。
     弹窗没有 `role=dialog` / `aria-modal`，空提交后 Tab 继续进入背景页面。

169. P1：改密错误缺少可访问播报。
     “请输入当前密码与新密码”没有 `role=alert`、`role=status` 或 `aria-live`。

170. P1：全局浮动工具菜单缺少弹出层语义和焦点边界。
     工具面板承担主题和 AI 入口，但 Tab 会进入 `body`、背景导航、用户菜单和业务入口。

171. P2：主题切换缺少完成播报。
     `light` 到 `dark` 的状态变化可见，但没有 status/live 告知读屏和键盘用户。

172. P1：AI 侧栏缺少区域语义和焦点 containment。
     侧栏打开后没有 dialog/complementary 语义，Tab 会离开侧栏进入背景页面。

173. P1：AI 侧栏关闭后的焦点恢复不稳定。
     Escape 关闭后第一个 Tab 落到 `body`，没有回到触发 AI 的浮动工具按钮。

174. P1：移动端主工作台没有统一可发现的导航入口。
     学生和教师移动端均未找到“打开平台导航/导航”抽屉按钮，实际仍是长页加横向导航。

175. P1：移动端全局 AI 先于页面主任务进入键盘路径。
     学生和教师移动端首个 Tab 都进入全局 AI 输入框，随后才到浮动工具、导航和业务内容。

176. P2：移动端全局浮层仍会压住内容卡片。
     学生移动端截图显示控灵和黑色浮动按钮贴近并覆盖卡片区域，长页避让不足。

## 7. 本批脚本与统计备注

- 本批 manifest 为 13 张截图、13 条 DOM/a11y JSON、3 个 API 检查、0 条 errors、0 条 ignoredErrors。
- 首次运行时服务在 3100 端口，但 `.env` 中 `NEXTAUTH_URL` 为 3001，退出登录会跳到错误端口；已用 `NEXTAUTH_URL=http://localhost:3100` 重启并重跑，最终 manifest 不含该误差。
- 本批没有修改密码、没有发送 AI 消息、没有改写业务数据；主题切换只发生在独立浏览器上下文内。
- 本批重新统计整份审计真实 PNG 数量后，当前总数为 768。
