## 1. 根布局脚本形态

- [x] 1.1 将 `src/app/layout.tsx` 的 `#theme-init` 改为 `dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }}`，保留 `id="theme-init"`，不引入 `next/script`
- [x] 1.2 确认不改 `buildThemeInitScript` / `resolveInitialTheme` 语义，不改「进入备课工作台」到 `/teacher/smart-prep` 的导航

## 2. 测试对齐

- [x] 2.1 更新 `react-doctor-security-surface.test.ts`：锁定审计 `dangerouslySetInnerHTML` 形态，禁止 children 脚本与 `next/script`
- [x] 2.2 确认 `tests/theme-init-script.spec.ts` 仍覆盖桌面/移动、首页/登录、已保存与系统回退，并收集 script-tag / hydration 控制台错误；按需补齐登录/退出首帧
- [x] 2.3 跑相关 vitest 与 theme-init Playwright（或仓库现有等价门禁）
