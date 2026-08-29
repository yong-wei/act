## Context

根布局当前固定输出 `html.dark`，`:root` CSS 变量也是夜间配色。用户主题只存在 `localStorage` 键 `ai-obe-theme`。`ThemeProvider` 在客户端 `useLayoutEffect` 里改 class，挡不住水合前的首次绘制。仓库里已有 `tests/theme-init-script.spec.ts` 与 `scripts/tests/test-theme-toggle.ts`，二者仍要求 `#theme-init` 与 `buildThemeInitScript()`。提交 `c871d4c0b` 删除了该脚本。约束见 proposal.md；行为契约见 specs。

## Goals / Non-Goals

**Goals:**

- 用与 `resolveInitialTheme` 相同的规则，在首次绘制前同步设置根 class 与 `color-scheme`。
- 水合后的客户端主题状态不得把 SSR 默认 `dark` 写回已保存的 `light`。
- 用现有 Playwright 关键 E2E 身份扩展登录/退出新文档路径。

**Non-Goals:**

- 不把主题持久化改到 Cookie，也不做服务端按请求输出不同 `html` class。
- 不改 `DEFAULT_THEME`、存储键、登录/退出 URL 或导航实现。
- 不改 `globals.css` 的 `:root` / `.light` 色板。

## Decisions

### Restore the audited head script, not `next/script` and not Cookie SSR

恢复 `buildThemeInitScript()`，并在根布局 Server Component 中使用已审计形态：

`<script id="theme-init">{buildThemeInitScript()}</script>`

脚本只内插存储键与已校验的 `light`/`dark` 默认值，包在 `try/catch` 中。这是 `react-doctor-security-surface-safety` 原来允许的约束写法：不用 `dangerouslySetInnerHTML`，也不用 `next/script`（后者会在客户端导航插入 script）。Cookie + SSR 被 Issue 排除。

`c871d4c0b` 为消 React Doctor 警告删掉脚本，并改成“根布局禁止任何 script”，这与既有 spec 的“水合前初始化主题”冲突。本变更把安全测试改回允许清单，而不是继续用删脚本掩盖警告。

### Do not let React own the theme class on `<html>`

根布局不再写死 `className="dark"`。否则水合和 App Router 客户端导航会把脚本已设置的 `light` 覆盖回 `dark`。SSR 回退仍由 `:root` 夜间变量与脚本 `catch` 路径承担。`ThemeProvider` 在 mount 以及路径变化时按同一规则 `applyTheme`。

### Re-resolve on mount before persisting

`ThemeProvider` 在首次 `useLayoutEffect` 中按存储与系统偏好重新解析并 `applyTheme`，仅在该次解析之后才把主题写回 `localStorage`。这样即使 SSR 状态仍是默认 `dark`，也不会覆盖脚本已应用的浅色主题。

### Login/logout coverage is document-load, not SPA-only

验收针对新文档渲染。浏览器测试在 `domcontentloaded`（脚本已执行）断言根 class 与 `color-scheme`，并对登录成功与 `signOut({ callbackUrl: '/login' })` 做同样断言。不改认证实现，只观察跳转后的新文档。

## Risks / Trade-offs

- [内联脚本被 CSP 拦截] → 仓库当前没有 CSP；契约测试断言 `#theme-init` 存在且首帧 class 正确，缺失即失败。
- [SSR 默认 `dark` 与客户端状态短暂不一致] → `html` 已有 `suppressHydrationWarning`；以脚本与 mount 再解析为准，禁止把 SSR 默认写回存储。
- [登录测试依赖本地 demo 账号与数据库] → 使用既有 `demo` / `DemoStudent@Just2026!` 凭据路径；若环境无账号，测试应明确失败而不是跳过首帧断言。

## Migration Plan

1. 恢复脚本生成函数与根布局注入，收紧 ThemeProvider 的 mount 持久化顺序。
2. 扩展单元/契约测试与 Playwright（含登录/退出）。
3. 无需数据迁移。回滚即去掉脚本会重新引入闪烁，故回归测试必须留在关键 E2E 集合中。

## Open Questions

无。Issue 已排除 Cookie/SSR 方案，并固定存储键与验收路径。
