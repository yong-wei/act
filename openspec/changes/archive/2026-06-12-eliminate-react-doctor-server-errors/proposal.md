## Why

React Doctor 全量本地扫描报告了 114 条 error，其中 19 条属于服务端鉴权、GET 请求副作用和跨请求共享状态问题。这些信号不是格式噪声，而是可能导致未授权访问、CSRF 触发写入、请求间状态污染的真实风险。

本变更优先消除服务端 error 级问题，为后续将 React Doctor 作为本地质量审计工具提供可信基线。

## What Changes

- 为 exported Server Actions 增加显式鉴权与授权边界，避免可被未登录客户端直接调用。
- 审查并修正 GET route handler 中的写入、创建、缓存突变或统计累加副作用；需要写入的接口改为 POST 或拆分为无副作用读取。
- 修正服务端模块作用域中被工具识别为可变共享状态的数组、对象或默认结构，保证请求间不会共享可变引用。
- 增加覆盖这些风险的服务端测试或静态验证脚本，并以 React Doctor error-only 本地扫描作为验收证据之一。

## Capabilities

### New Capabilities

- `server-action-and-route-safety`: Defines authentication, request-method side-effect, and server module-state safety requirements for Server Actions and App Router route handlers.

### Modified Capabilities

- None.

## Impact

- Affects `src/app/actions/mission.ts`, `src/app/actions/control-odyssey.ts`, and GET handlers currently flagged by React Doctor.
- May affect clients that call state-changing GET endpoints if those endpoints are converted to POST or split into read/write operations.
- Adds or updates focused tests around unauthenticated access, method semantics, and request isolation.
- Does not connect React Doctor to GitHub Actions; validation remains local-only.
