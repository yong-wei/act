# Design: issue-2089-next-js-16-3-4-react

## Context

根布局 `src/app/layout.tsx` 在 `<head>` 输出：

```tsx
<script id="theme-init">{buildThemeInitScript()}</script>
```

`buildThemeInitScript()` 只插值仓库常量 `ai-obe-theme` 与校验过的 `light`/`dark` 默认值，语义正确。错误在交付形态：把脚本正文当作 React children。React 19 客户端渲染该节点时不执行，并报 script-tag 警告。

`react-doctor-security-surface.test.ts` 当前断言禁止 `next/script` 与 `dangerouslySetInnerHTML`，并要求上述 children 写法。`tests/theme-init-script.spec.ts` 又收集同一控制台错误。常规集成门禁未跑该 Playwright 场景，回归进入了 integration。

## Goals / Non-Goals

- Goals：消除客户端 script-tag 警告；保持水合前首帧主题；`#theme-init` 只注入一次；安全测试与浏览器测试对齐。
- Non-Goals：不改主题解析；不加遮罩或延迟正文；不改 `/teacher/smart-prep` 导航；不引入 CSP 或外部脚本。

## Decisions

1. **使用 React 19 受支持的内联脚本，不用 `next/script`。**  
   Next.js App Router 的 `Script strategy="beforeInteractive"` 对无 `src` 脚本写入 `self.__next_s` 队列，不把主题 IIFE 作为立即执行标签输出。水合前首帧会回退到 #1690 已修过的闪烁。  
   正确形态：

   ```tsx
   <script id="theme-init" dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />
   ```

   浏览器解析 HTML 时立即执行；React 19 不再把该节点当成「children 脚本」。`id="theme-init"` 保留给 Playwright。

2. **`dangerouslySetInnerHTML` 只允许这一处，且内容必须来自 `buildThemeInitScript()`。**  
   禁止用户输入、禁止手写第二段主题脚本、禁止 `next/script`。handout print 的 `<style>` 合同不变。

3. **测试改锁正确形态，而不是锁旧写法。**  
   静态测试断言 `dangerouslySetInnerHTML` + `buildThemeInitScript()` + `id="theme-init"`，并禁止 children 脚本与 `next/script`。浏览器测试继续在 `domcontentloaded` 断言根 class / `colorScheme`，并收集 script-tag / hydration 错误；覆盖桌面/移动、首页/登录，以及已有登录/退出路径。

## Risks / Trade-offs

- [误用 `next/script` 满足字面建议] → 首帧闪烁回归。设计明确否决，测试锁定 `from 'next/script'` 不出现。
- [`dangerouslySetInnerHTML` 被后续改成用户插值] → 静态测试继续断言脚本正文不含 `</script`，且 layout 只引用 `buildThemeInitScript()`。
- [Playwright 未进门禁] → 本 change 不扩大 CI 触发面；保持现有 spec 场景可跑，并在任务中写明本地/集成应覆盖该文件。
