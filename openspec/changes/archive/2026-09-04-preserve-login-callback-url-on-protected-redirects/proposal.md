## Why

2026-09-04 QA 巡检（Issue #1936，P1）发现未登录访问 `/dashboard` 等受保护页时，服务端以裸 `redirect('/login')` 跳转（`src/app/(main)/dashboard/page.tsx:10` 为例，全仓约 28 处同模式调用点），原始目标 URL 丢失。登录页本身已完整支持 `callbackUrl`（`src/app/(auth)/login/page.tsx` 的 `resolveCallbackTarget` 与 `CredentialLoginForm` 回调链），问题只在重定向侧从不携带该参数，深链与书签在登录后无法回跳。

## What Changes

- 提供共享的受保护页登录重定向 helper：服务端鉴权失败重定向 `/login` 时，自动附带 `callbackUrl=<当前请求路径（含查询串），URL 编码>`。
- 迁移全部裸 `redirect('/login')` 调用点（app 路由下的页面/布局，约 28 处）到该 helper；测试文件中的字符串断言同步更新。
- 保持登录页现有 callbackUrl 解析与登录成功回跳行为不变；对显式希望丢弃目标的入口（如角色驾驶舱兜底跳转）允许不带参数的显式用法。
- 增加重定向契约测试：受保护页未登录访问的 Location 携带正确编码的 callbackUrl。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `platform-role-navigation`: 受保护页的未登录重定向必须保留原始目标意图，与登录页既有 callbackUrl 语义闭环。

## Impact

- 新增共享重定向 helper（`src/lib/` 下，复用 `appendLoginPageHashToRedirectPath` 所在 auth-redirect 模块体系）。
- 约 28 处 `redirect('/login')` 调用点迁移（teacher/admin/classroom/assessment/(main) 路由组与 smart-prep 等页面）。
- 相关契约测试（`platform-ui-contracts.test.ts` 等）更新与新增。
- 不改 middleware（仓库无全局 middleware 鉴权），不改登录页回调逻辑，不新增开放重放面（callbackUrl 仅接受站内路径，沿用登录页现有判定）。
