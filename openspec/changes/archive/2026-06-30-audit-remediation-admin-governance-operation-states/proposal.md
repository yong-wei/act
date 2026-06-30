## Why

管理员剩余问题不是缺少入口，而是导入/配置/治理/下载动作缺少预览、影响范围、批次审计、完成反馈和移动可用状态。已有 admin operation ledger，但仍有多处页面没有接入。

## What Changes

- 补齐批量导入预览、确认、失败行下载、批次治理和回滚/不可回滚说明。
- 统一用户 no-match、角色分页、API/UI 过滤口径和移动卡片化展示。
- 补齐配置保存、模型测试、治理 risk resolve、统计导出的状态与审计摘要。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `audit-remediation-admin-operations-ledger`: 要求所有管理员导入、配置、模型测试、治理、导出动作接入 durable operation state。
- `admin-data-governance-dashboard`: 要求治理风险从只读列表升级为可处置工作流并保持隐私边界。
- `audit-remediation-admin-governance-workflows`: 要求用户管理、配置和治理页面的 API/UI 口径一致。

## Impact

影响 `/admin/users`、`/admin/config`、`/admin/data-governance`、`/admin/states`、admin operation ledger runtime/API/tests and mobile audit evidence。
