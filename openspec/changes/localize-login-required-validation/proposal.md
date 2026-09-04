## Why

2026-09-04 QA 巡检（Issue #1938）发现登录页（`src/components/shared/credential-login-form.tsx:89,102`）的学号/密码输入框依赖 HTML 原生 `required` 校验，空提交时提示为浏览器语言的英文 "Please fill out this field."。登录页是全中文商业入口，原生提示绕过了平台文案体系，且不可控、不可测。

## What Changes

- 登录表单改为平台可控的必填校验：空字段提交时展示统一风格的中文提示（如「请输入学号/工号」「请输入密码」），不再依赖浏览器原生气泡。
- 校验提示与既有表单错误态（凭据错误等）视觉一致，且可访问（`aria-describedby`/`role=alert` 语义）。
- 不改变既有提交流程、防抖与回调链；仅在提交前增加必填拦截。
- 增加空提交与单字段为空的单元测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `commercial-student-entry-surfaces`: 认证表面是商业入口表面，其表单校验文案必须由平台治理而非浏览器语言决定。

## Impact

- `src/components/shared/credential-login-form.tsx`（表单校验逻辑与提示 UI）。
- 相关单元测试。
- 不改服务端鉴权、不改登录回调语义。
