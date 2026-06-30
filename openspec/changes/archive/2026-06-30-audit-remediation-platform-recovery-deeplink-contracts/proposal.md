## Why

基础 API/UI contract 和 error-status-a11y 已归档，但多个垂直路由仍把坏参数吞掉、静默重定向、显示 raw id 或落到默认 404。需要把恢复合同应用到真实路由族。

## What Changes

- 定义并应用跨路由的 invalid/missing/unauthorized/stale/degraded 恢复状态。
- 要求 API 与 UI 对 no-match、bad id、missing context 和 unsupported method 使用同一语义。
- 降低全局 AI/浮动工具在错误页的优先级，保证恢复动作是第一任务。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `audit-remediation-platform-error-status-a11y`: 要求产品恢复状态覆盖具体坏 ID 和权限 deep link 路由。
- `audit-remediation-api-ui-contracts`: 要求 API/UI 对搜索、筛选、分页、坏 ID 和方法边界保持一致。
- `platform-status-and-evidence-ui`: 要求错误、缺上下文、低置信和恢复状态继承当前 route archetype。

## Impact

影响 known platform routes with route params/search params, classroom join, adaptive path, teacher/admin/student bad-id pages, API route tests, and shared recovery components。
