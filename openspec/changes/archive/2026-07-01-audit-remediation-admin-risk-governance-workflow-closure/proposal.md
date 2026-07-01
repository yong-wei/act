## Why

管理员 operation-states 已归档，导入、配置、导出、no-match 和移动表格状态已有证据。审计报告仍保留的管理员核心残余是风险治理本身仍像只读看板：170 个风险可见，但风险行没有稳定进入证据、分派、标记处理、撤销和审计记录的对象化工作流。

## What Changes

- 将治理风险行建模为可操作对象，支持查看证据、分派负责人、标记处理、撤销处理和查看审计记录。
- 让 `tab=risks&action=resolve/assign` 等 URL intent 直达风险治理上下文，而不是停留 loading 或普通列表。
- 对风险处置结果提供状态播报、失败恢复和审计记录。
- 回写审计报告和 evidence，只关闭风险治理对象化 finding，不重复关闭导入/配置/导出已归档范围。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `audit-remediation-admin-governance-workflows`: 扩展风险行级证据、分派、处置、撤销和审计工作流。

### Related Capabilities
- `admin-data-governance-dashboard`
- `audit-remediation-admin-operations-ledger`

## Impact

影响管理员数据治理页、风险列表、风险详情/证据入口、分派/处置/撤销 API、治理审计记录、URL intent 和相关测试。
