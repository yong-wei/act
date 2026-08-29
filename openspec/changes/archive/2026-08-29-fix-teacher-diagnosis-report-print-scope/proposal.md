# Change: Fix teacher diagnosis report browser print scope

## Why

教师版学情诊断报告页（`/teacher/classes/[classId]/diagnosis-reports/[reportId]`）使用浏览器打印时，打印预览混入应用壳层：顶部面包屑、教师工作台标题与说明、主题切换、用户头像和个人中心菜单、平台主导航侧栏、班级页签（教师总览、班级、教案、作业、资源、智能备课、课前包、课堂历史）等。报告交付组件自身已对页头与处置区做了 `print:hidden`，但包裹它的共享壳层（`RoleWorkspaceShell` → `AppShell`）没有任何打印规则，这些壳层控件全部进入打印输出。历史变更 `issue-1485-diagnosis-outcomes-print-only` 已确立浏览器打印是唯一报告交付通道，打印输出范围失控直接破坏交付质量。

## What changes

- 在共享平台壳层（`AppShell`）的壳层控件上补充打印媒体规则：顶部头部（面包屑、工作台标题/说明、主题切换、用户菜单）、桌面侧栏、移动导航与抽屉入口栏、工作台 command-bar 页签区在打印时隐藏。
- 补齐 `no-print` 工具类的真实 CSS 定义：浮动控件层已经引用该类但没有定义，导致浮动操作控件进入打印输出；补上后所有引用方获得一致的打印隐藏语义。
- 报告交付组件保持既有打印规则（报告页头、处置区隐藏，正文铺满），不新增导出入口。
- 验收以 Edge 打印预览为准：保留 Edge 自动添加的日期、网站标题等浏览器页眉页脚；正常浏览状态的导航与交互不变。

## Non-goals

- 不新增“导出 PDF”按钮或其他导出入口，不恢复前端 PDF 请求。
- 不修改 Edge 自带的打印页眉和页脚设置。
- 不改变页面在非打印状态下的现有导航与交互。
- 不改动服务端 PDF 工件、导出审计或已发布的服务端 PDF 接口。
- 不重构 `AppShell` / `RoleWorkspaceShell` 的屏幕布局或导航结构。

## Impact

- Specs：`teacher-diagnosis-report-delivery`（新增打印呈现范围需求）。
- Code：`src/components/platform/app-shell.tsx`（壳层控件打印类）、`src/app/globals.css`（`no-print` 工具类）；报告页与其余教师页面的打印输出收敛，屏幕表现无变化。
- Tests：壳层打印类与 `no-print` 定义的单元断言；既有报告交付测试继续通过。
