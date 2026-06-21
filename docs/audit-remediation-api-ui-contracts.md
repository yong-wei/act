# Audit Remediation API/UI Contracts

本合同用于 Product Design 审计中反复出现的 URL 参数、API 返回和 UI 可见状态不一致问题。它定义共用解释规则，并要求后续垂直整改在关闭具体页面缺陷前补充真实页面或 API 证据。

## 参数解释规则

- 搜索参数优先支持审计脚本使用的 `q`，兼容旧 `search`。
- `role`、`page`、`pageSize` 等筛选/分页参数必须进入同一份查询合同，UI 列表、计数、分页和 API 返回使用同一结果集。
- `action`、`targetId`、`userId`、`returnTo` 只能作为上下文或显式状态来源，不得静默执行危险动作。
- `returnTo` 只接受站内绝对路径；外部 URL 或协议相对 URL 必须丢弃。

## 审计参数分类

| 参数 | 分类 | 合同处理 |
| --- | --- | --- |
| `q` | supported | 作为审计脚本和页面搜索的首选搜索参数。 |
| `search` | legacy-compatible | 兼容旧链接；当 `q` 存在时由 `q` 覆盖。 |
| `role` | supported / invalid | 支持 `UserRole` 与 `ALL`；未知角色进入 invalid source 标记，不进入实际筛选。 |
| `page` | supported / invalid | 正整数进入分页；无效值回退第 1 页并保留 invalid source 标记。 |
| `pageSize` | supported / invalid | 正整数进入分页并限制在 1-50；无效值回退默认值。 |
| `action` | unsupported-by-url | 只显示状态，不通过 URL 自动执行导出、重置、写回等动作。 |
| `targetId` / `userId` | context-only | 作为恢复态和状态说明上下文，不绕过页面权限或执行动作。 |
| `returnTo` | supported / invalid | 只接受站内绝对路径；外部地址、协议相对地址和空值丢弃。 |
| `assignment` / `riskId` / `gradingRunId` / `pathId` / `lessonId` | vertical-contract | 由对应垂直页面消费共享 bad-object、unauthorized、invalid-parameter 恢复态。 |

## 已接入页面

- `/admin/users`：`q`、`role`、`page`、`pageSize`、`action`、`targetId/userId` 由 `normalizeAdminUsersQueryContract` 解释。
- `/api/admin/users`：同一查询合同驱动 `where`、分页和返回 `query` 元数据，no-match 不再显示无关真实记录。
- `action=export` 和 `action=reset` 在账号页显示显式 unsupported 状态，不再被吞掉或伪装成已执行。

## 后续垂直整改消费要求

- 学习路径、证据、assignment 和 returnTo：使用 `buildApiUiRecoveryState` 表达 missing path、invalid assignment、unauthorized、invalid returnTo。
- 教师报告、评分、班级学生和治理 deep link：缺失 `gradingRunId`、`studentId`、`riskId`、`assignee` 时保留来源角色和 returnTo，显示 bad-object 或 unauthorized 恢复态。
- API 405/404/401/403：页面必须映射到 unsupported-method、bad-object 或 unauthorized 状态，不得只显示通用错误页或跳回首页。

## 验收要求

- 关闭具体审计缺陷前，必须同时保存 UI 截图/DOM 证据和 API 响应证据。
- 审计报告只能标注已经完成页面级验收的 finding；本基础合同只关闭 API/UI 查询解释层和管理员用户 no-match 代表路径。
