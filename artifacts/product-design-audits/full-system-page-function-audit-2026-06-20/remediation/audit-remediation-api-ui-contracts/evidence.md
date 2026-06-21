# audit-remediation-api-ui-contracts Evidence

日期：2026-06-21
OpenSpec change：`audit-remediation-api-ui-contracts`
关联 issue：#612

## 覆盖范围

本变更建立 API/UI 参数解释和恢复状态合同，并实际接入管理员用户列表的 `q`、`role`、`page`、`pageSize`、`action`、`targetId/userId` 路径。学习路径、教师报告、评分、治理等深链在本变更中获得共享恢复状态形态和消费说明；具体页面 finding 仍需后续垂直变更接入后再关闭。

## 代表性审计证据

- `chapters/52-function-state-flows-batch44.md`、`chapters/53-function-state-flows-batch45.md`：坏 ID、缺失对象和泛化 404 状态需要产品级恢复。
- `chapters/63-function-state-flows-batch55.md` 至 `chapters/67-function-state-flows-batch59.md`：管理员用户 no-match、角色筛选、分页、导出、治理 risk、评分 run、学习路径和 returnTo 多次出现 API/UI 口径不一致。
- `chapters/65-function-state-flows-batch57.md` 和 `chapters/66-function-state-flows-batch58.md`：`q`/`role`/`page` no-match 仍显示真实用户，治理/评分/配置 deep link 缺少 missing-object 或 unsupported-method 状态。

## 代码证据

- `src/lib/api-ui-contracts.ts`：定义管理员用户查询合同、`q`/`search` 兼容、role/page/pageSize/action/targetId 标准化，以及 bad-object、unauthorized、unsupported-method、invalid-parameter、no-match 恢复状态。
- `src/app/admin/users/page.tsx`：读取 URL 查询并传入 `AdminDashboard`。
- `src/app/api/admin/users/route.ts`：使用同一查询合同构造 Prisma `where`、分页和响应 `query` 元数据。
- `src/features/admin/admin-dashboard.tsx`：用 URL 初始查询设置搜索/角色/分页状态；no-match 显示当前条件；`action=export/reset` 显示显式 unsupported 状态。
- `docs/audit-remediation-api-ui-contracts.md`：记录学习路径、证据、教师报告、评分和治理 deep link 的后续消费规则。

## 验证记录

```bash
rtk npm run test:unit -- src/lib/__tests__/api-ui-contracts.test.ts src/app/__tests__/admin-users-api-ui-contract.test.ts src/features/admin/__tests__/admin-dashboard-api-ui-contract.test.ts src/lib/__tests__/action-status-contract.test.ts src/app/__tests__/action-status-panel.test.ts
```

结果：5 个测试文件、17 个用例通过，覆盖管理员用户 q/role/page/action 合同、API q 过滤、Dashboard no-match 文案、URL action unsupported/invalid-parameter 面板、bad-object/unsupported-method 恢复状态、安全 `returnTo` 过滤和 action status 基础合同。

```bash
rtk npm run lint
```

结果：通过，0 warning。

```bash
rtk openspec validate audit-remediation-api-ui-contracts --strict
rtk git diff --check
```

结果：OpenSpec change 严格校验通过；diff 空白检查通过。

## 未关闭项

本变更不关闭学习路径、教师报告、评分、治理、配置测试等具体页面缺陷；这些页面需要在后续垂直变更中消费本合同，并补真实路由/API 证据后再标注整改。
