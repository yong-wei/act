# Task: Fix teacher diagnosis report browser print scope

## 1. 壳层打印规则

- [ ] 1.1 `AppShell` 的 `AppHeader` 顶部头部（面包屑、工作台标题/说明、主题切换、用户菜单）在打印媒体隐藏。
- [ ] 1.2 桌面侧栏（`CollapsibleAppSidebar` 与固定模式 `AppSidebar`）在打印媒体隐藏。
- [ ] 1.3 移动导航条与抽屉入口栏在打印媒体隐藏。
- [ ] 1.4 工作台 `command-bar` zone（班级页签等 workspace 导航）在打印媒体隐藏。

## 2. `no-print` 工具类

- [ ] 2.1 `globals.css` 定义打印媒体下的 `.no-print { display: none !important; }`，使浮动控件层既有引用生效。

## 3. 测试与验证

- [ ] 3.1 壳层打印隐藏类存在性断言（header、侧栏、移动导航、command-bar zone）。
- [ ] 3.2 `no-print` 类在 CSS 中有打印媒体定义的断言。
- [ ] 3.3 既有 `diagnosis-report-delivery-view` 打印相关测试通过。
- [ ] 3.4 `npm run typecheck`、相关 Vitest 套件、`npm run lint` 通过。
