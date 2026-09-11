# Proposal: issue-2089-next-js-16-3-4-react

映射 GitHub Issue: #2089「修复主题初始化脚本在 Next.js 16.3.4 下的 React 客户端渲染回归」。

## Why

Issue 经代码核查判定**属实**。根布局仍用原生 `<script id="theme-init">{buildThemeInitScript()}</script>` 把内联 JS 当作 React 子节点。React 19 / Next 16.3.4 客户端渲染该节点时不执行脚本，并报 `Encountered a script tag while rendering React component`。这是 #1341 同类回归，并与 #1690 的水合前首帧合同冲突。

冲突真源是 `react-doctor-security-surface-safety`：它同时禁止 `next/script` 与 `dangerouslySetInnerHTML`，并锁定上述子节点写法。静态测试因此冻结错误实现；浏览器测试又要求不得出现同一控制台错误。

Issue 优先建议 `next/script` `beforeInteractive`。仓库对照 Next.js 实现后否决该路径：App Router 下 `beforeInteractive` 的无 `src` 脚本不会把主题 IIFE 写成可立即执行的标签，而是 `self.__next_s` 队列占位。主题 class 会晚于首次绘制，破坏 #1690。

## What Changes

- 根布局改用已审计的 `<script id="theme-init" dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />`。这是 React 19 对内联脚本的受支持写法，浏览器仍在首帧前执行同一 IIFE。
- 修订 `react-doctor-security-surface-safety`：允许且仅允许该主题脚本使用 `dangerouslySetInnerHTML`；继续禁止 `next/script`、用户可控插值、以及把脚本正文当作 React children。
- 更新静态安全测试与 `theme-init-script` 浏览器回归，使二者同时锁定「无 React script-tag 警告」和「水合前首帧正确」。
- 不改 `ai-obe-theme` / 系统回退 / 默认主题语义，不用遮罩掩盖闪烁，不改「进入备课工作台」到 `/teacher/smart-prep` 的导航。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `react-doctor-security-surface-safety`：主题初始化场景改为 React 19 受支持的审计内联脚本，不再禁止该处的 `dangerouslySetInnerHTML`，并明确禁止 `next/script` 与 children 脚本。

## Impact

- 代码：`src/app/layout.tsx`、`src/lib/__tests__/react-doctor-security-surface.test.ts`、`tests/theme-init-script.spec.ts`（按需补登录/退出覆盖）。
- 非目标：不改 `buildThemeInitScript` 主题解析规则、不加加载遮罩、不改教师备课导航、不恢复公网 CSP 之外的脚本注入面。
