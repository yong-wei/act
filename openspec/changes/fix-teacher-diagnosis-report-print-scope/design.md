# Design: Fix teacher diagnosis report browser print scope

## Context

- 打印链路：教师报告页由 `src/app/teacher/layout.tsx` 包裹 `RoleWorkspaceShell` → `AppShell`，报告正文由 `DiagnosisReportDeliveryView` 渲染。
- 壳层控件与 issue 清单的对应：面包屑、工作台标题/说明、主题切换、用户菜单 → `AppHeader`；教师驾驶舱等主导航 → `CollapsibleAppSidebar` / `AppSidebar` 与移动导航；班级页签 → teacher layout 注入 `workspaceSlots.commandBar` 的 `TeacherOperationsNav`（渲染在 `data-app-shell-zone="command-bar"`）；打印按钮 → `DiagnosisReportDeliveryView` 页头（已 `print:hidden`）。
- 全站仅 `DiagnosisReportDeliveryView` 调用 `window.print()`；浮动控件层已引用 `no-print` 类但仓库内没有任何 CSS 定义。

## Decision

1. **打印卫生归属壳层，而不是报告组件。** 壳层控件（header、侧栏、移动导航、command-bar 页签区）是应用操作层，在任何打印输出中都不属于交付内容；在 `AppShell` 的对应元素上加 Tailwind `print:hidden`，一次性覆盖教师/学生诊断报告与未来其它打印场景，避免每个内容页各自对抗壳层。屏幕媒体不受影响，满足“非打印状态导航与交互不变”。
2. **`no-print` 落成真实工具类。** 在 `globals.css` 的 `@media print` 中定义 `.no-print { display: none !important; }`，让 `page-floating-controls` 既有引用立即生效，并成为后续组件的统一打印隐藏出口。壳层控件使用 Tailwind `print:` 变体（与报告组件既有写法一致），`no-print` 保留给动态浮动层。
3. **command-bar zone 整体打印隐藏是安全的。** 全仓只有两个 teacher workspace layout 使用 `commandBar` slot，且内容都是导航页签；zone 上隐藏不会误伤页面正文（正文在 `instrument-area` 或 children）。
4. **浏览器页眉页脚交给浏览器。** Edge 自动添加的日期、网站标题属于打印预期内容，由浏览器打印设置控制，前端不干预。

## Alternatives considered

- 报告页内用全局选择器（如 `body * { visibility: hidden }` 反转可见性）圈定打印内容：对抗壳层 sticky/fixed 布局脆弱，且会污染其它路由的打印语义，放弃。
- 在 teacher layout 检测报告路由后条件渲染壳层：改变屏幕态结构，超出“打印样式与打印内容范围”的实现边界，放弃。

## Risks / trade-offs

- 其它页面（理论上）打印时也会失去壳层 chrome：壳层 chrome 本来就不是交付内容，且当前只有诊断报告存在打印流程；属预期收敛。
- Tailwind 类名字符串断言较脆：测试同时断言壳层控件携带打印隐藏类与 `no-print` 在 CSS 中有定义，二者任一回归都会显式失败。

## Migration Plan

单次提交内完成样式与测试；无数据、无迁移、无配置变更。

## Open Questions

无。
