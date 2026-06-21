# audit-remediation-mobile-a11y-shell 整改证据

日期：2026-06-21
Issue：#617
Change：`audit-remediation-mobile-a11y-shell`

## 覆盖范围

本变更只关闭移动壳层、窄屏横向溢出、浮动工具/AI 侧栏语义、代表性后台/教师表格移动化、固定主动作和 `status/live` 播报缺陷。业务状态机仍归属各自垂直变更；例如学生报告反馈写回、任务大厅回流、作品集收录、治理撤销、评分真实写回和仿真 mission 完成回写不在本变更中关闭。

## 审计证据来源

- `chapters/49-function-state-flows-batch41.md`：235、236、237、239、242、243。
- `chapters/53-function-state-flows-batch45.md`：285 及跨列表状态播报相关复证。
- `chapters/54-function-state-flows-batch46.md`：296、297，以及新建账号 dialog 语义证据。
- `chapters/55-function-state-flows-batch47.md`：306、307。
- `chapters/56-function-state-flows-batch48.md`：319。
- `chapters/57-function-state-flows-batch49.md`：331、332、333。
- `chapters/58-function-state-flows-batch50.md`：344、345 的移动治理/教师报告代表证据。
- `chapters/59-function-state-flows-batch51.md`：359、360 的移动管理页与状态播报复证。
- `chapters/62-function-state-flows-batch54.md`：393 的移动报告/治理固定主动作复证。
- `chapters/64-function-state-flows-batch56.md`：418 的宽表长页复证。
- `chapters/67-function-state-flows-batch59.md`：451，以及管理员 320px 用户/治理和教师移动长报告复证。

## 已落地整改

- `src/components/shared/page-floating-controls.tsx`
  - 展开面板增加稳定 `id`、`role="region"`、`aria-labelledby` 和隐藏标题。
  - 触发按钮增加 `aria-controls`。
  - 主题切换、菜单打开/关闭和工具打开写入 `role=status` / `aria-live=polite`。
- `src/components/ai/global-ai-sidebar.tsx`
  - 打开态侧栏保留 `role=dialog`、`aria-modal`、`inert`，并增加首次聚焦、容器持焦、Tab/Shift+Tab 循环焦点 containment。
  - 关闭按钮补明确可访问名称。
- `src/app/globals.css`
  - 管理员表格在 640px 以下支持 `data-admin-mobile-cards="true"` 卡片化，移除 640px 最小表格宽度对页面主体的横向撑宽。
  - 教师学生清单在 640px 以下支持 `data-teacher-mobile-cards="true"` 卡片化。
  - 卡片化单元格使用 `data-label` 生成字段标签，按钮行回到左对齐动作组，长邮箱/长 ID 使用 `overflow-wrap:anywhere` 防止撑宽。
- `src/features/admin/admin-dashboard.tsx`
  - 用户列表增加 `data-admin-users-list-status` 的 `role=status` 播报。
  - 用户表格增加移动卡片标记与 `data-label`。
  - 搜索、角色筛选、导出、批量导入、新建账号、分页和行内查看/改密/删除动作补明确名称。
  - 新建账号与改密弹窗增加 `role=dialog`、`aria-modal`、可访问标题、初始焦点、Tab/Shift+Tab 循环、Escape 关闭和 opener 焦点恢复。
  - 通知按成功/错误进入 `status` 或 `alert`。
- `src/features/admin/data-governance-dashboard.tsx`
  - 治理看板增加 `data-admin-governance-status` 的 `role=status` 播报。
  - 治理视图切换保留普通按钮语义，使用 `aria-pressed` 和 `aria-current` 标记当前视图，避免不完整 tabpanel 合同。
  - 来源、课堂质量和风险表格增加移动卡片标记与 `data-label`。
  - 刷新、下载、处置、分派动作补明确名称。
- `src/app/teacher/classes/[classId]/analytics-v2/page.tsx`
  - 教师报告交付增加 `data-teacher-report-delivery-status` 的 `role=status` 播报。
  - 移动固定交付动作区继续作为长报告窄屏主动作入口。
  - 返回、刷新、导出 JSON、复制摘要和能力矩阵视图切换补可访问状态或名称。
- `src/app/teacher/classes/[classId]/page.tsx`
  - 班级详情增加 `data-teacher-class-detail-status` 播报，并将关键操作反馈同步到可见 `data-teacher-class-visible-status`。
  - 学生清单增加移动卡片标记与 `data-label`。
  - 开始上课弹窗增加 `role=dialog`、`aria-modal`、可访问标题、初始焦点、Tab/Shift+Tab 循环、Escape 关闭和 opener 焦点恢复。
  - 复制课堂码、开始上课、状态筛选、停止课堂、添加学生、学生详情和移除学生补明确名称。
- `tests/mobile-a11y-shell.spec.ts`
  - 使用 NextAuth 测试 cookie 与 API mock 覆盖认证态 320px/390px 页面。
  - 验证 `/admin/users`、`/admin/data-governance`、`/teacher/classes/[classId]/analytics-v2`、`/teacher/classes/[classId]` 的页面主体不发生横向溢出，并检查状态播报、移动表格和固定动作区存在。
  - 验证管理员新建账号/改密弹窗、教师开始上课弹窗在 320px 下保持焦点在弹窗内，支持正向 Tab 循环、容器持焦 Shift+Tab 循环、Escape 关闭和 opener 焦点恢复；验证教师班级加入码复制反馈可见。
  - 验证 Global AI 侧栏从共享浮动 dock 打开后，初始焦点、正向 Tab 循环、容器持焦 Shift+Tab 循环、Escape 关闭和 dock 入口焦点恢复成立。

## 浏览器证据

截图、DOM width 和键盘证据均由 `rtk npx playwright test tests/mobile-a11y-shell.spec.ts` 在 2026-06-21 生成，目录为 `playwright/`。

| 证据 | viewport | DOM width | 截图 |
|---|---:|---:|---|
| `admin-users-320-dom-width.json` | 320 | `scrollWidth=320` / `bodyScrollWidth=320` | `playwright/admin-users-320.png` |
| `admin-users-390-dom-width.json` | 390 | `scrollWidth=390` / `bodyScrollWidth=390` | `playwright/admin-users-390.png` |
| `admin-data-governance-320-dom-width.json` | 320 | `scrollWidth=320` / `bodyScrollWidth=320` | `playwright/admin-data-governance-320.png` |
| `admin-data-governance-390-dom-width.json` | 390 | `scrollWidth=390` / `bodyScrollWidth=390` | `playwright/admin-data-governance-390.png` |
| `teacher-report-320-dom-width.json` | 320 | `scrollWidth=320` / `bodyScrollWidth=320` | `playwright/teacher-report-320.png` |
| `teacher-report-390-dom-width.json` | 390 | `scrollWidth=390` / `bodyScrollWidth=390` | `playwright/teacher-report-390.png` |
| `teacher-class-detail-320-dom-width.json` | 320 | `scrollWidth=320` / `bodyScrollWidth=320` | `playwright/teacher-class-detail-320.png` |
| `teacher-class-detail-390-dom-width.json` | 390 | `scrollWidth=390` / `bodyScrollWidth=390` | `playwright/teacher-class-detail-390.png` |

键盘/a11y 证据：

- `playwright/admin-users-dialog-keyboard-320.json`：管理员新建账号与改密弹窗的初始焦点、正向 Tab 循环、容器持焦 Shift+Tab 循环、Escape 关闭和 opener 恢复。
- `playwright/global-ai-sidebar-keyboard-320.json`：共享浮动 dock 打开 Global AI 侧栏、初始焦点、正向 Tab 循环、容器持焦 Shift+Tab 循环、Escape 关闭和 dock 入口恢复。
- `playwright/teacher-class-dialog-keyboard-320.json`：教师开始上课弹窗的初始焦点、正向 Tab 循环、容器持焦 Shift+Tab 循环、Escape 关闭、opener 恢复和可见状态反馈。

## 验证

- `rtk npm run test:unit -- src/features/interactive/__tests__/floating-controls.test.ts src/features/admin/__tests__/admin-dashboard-api-ui-contract.test.ts src/features/admin/__tests__/admin-governance-action-contract.test.ts src/features/teacher/__tests__/teacher-insights.test.ts`
  - 4 files passed
  - 29 tests passed
- `rtk npx playwright test tests/mobile-a11y-shell.spec.ts`
  - 2 tests passed
  - 覆盖 320px 与 390px 认证态 mock 页面、DOM width、截图、代表弹窗与 Global AI 侧栏键盘焦点证据。
- `rtk npm run lint`
  - passed
- `rtk openspec validate audit-remediation-mobile-a11y-shell --strict`
  - passed
- `rtk git diff --check`
  - passed

## Finding 对应

- 已关闭：235、236、237、239、242、243、285、296、332 中与浮动工具语义、Global AI 焦点 containment、管理员用户/治理表格移动卡片化和 320px/390px document width 直接相关的证据。
- 部分关闭：297、306、307、319、331、333、344、345、359、360、393、394、418、419、451。本变更只关闭代表页面的移动宽度、固定主动作、焦点循环、可访问名称和 `status/live` 基础证据；这些 finding 中的业务状态机、导出/发送/评分/治理处置/配置审计仍由对应垂直变更关闭。
- 不关闭：学生报告反馈采用/写回、任务大厅 returnTo、作品集收录、仿真 mission 完成回写、评分真实写回、治理撤销、数据中心导出/returnTo、配置模型测试深层合同、教师报告补强任务创建和管理员配置移动固定动作区。
