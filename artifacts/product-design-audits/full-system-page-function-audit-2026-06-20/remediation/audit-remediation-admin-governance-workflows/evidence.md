# audit-remediation-admin-governance-workflows 证据

日期：2026-06-21
Issue：#614
Change：`audit-remediation-admin-governance-workflows`

## 覆盖范围

- 管理员用户：`/admin/users`
- 管理员治理：`/admin/data-governance`
- 管理员配置：`/admin/config`
- 管理员统计：`/admin/states`
- 用户导入 API：`/api/admin/users/import`

## 代码证据

- `src/features/admin/admin-dashboard.tsx`
  - `q/search`、`role`、`page/pageSize` 继续通过 `/api/admin/users` 统一过滤。
  - `action=export` 不再显示为 unsupported，而是保留当前筛选并提供“导出当前筛选”动作。
  - 导出调用 `/api/admin/users/export`，按完整筛选集生成 CSV；空结果导出只包含表头，不会导出无关用户。
  - 导入先进入 preview 解析和校验，确认后才提交；结果展示 `batchId`、失败行下载、审计记录和自动回滚未启用状态。
- `src/app/api/admin/users/export/route.ts`
  - 按 `q/search` 与 `role` 导出完整筛选集，不读取当前分页。
- `src/app/api/admin/users/import/route.ts`
  - 支持 `mode=preview`，预览时只解析、校验和判断 create/update，不写库。
  - 返回 `batchId` 与 `auditRecord`，记录 actor、batch、mode、created、updated、failed、outcome、rollbackAvailable、recordedAt。
- `src/features/admin/admin-governance-action-contract.ts`
  - 对 `resolve`、`assign`、`export` 建立对象化状态。
  - 缺失 `riskId`、不存在 risk、缺失 assignee 均返回 blocked 恢复状态和审计记录。
  - `export` 返回可下载文件名和 export-ready 审计记录；有效 `resolve/assign` 深链在 API 提交前保持 pending。
- `src/app/api/admin/data-governance/risks/[riskId]/actions/route.ts`
  - `resolve` 持久更新 `StudentRiskFlag.isResolved/resolvedAt/resolutionNote`，并把动作审计追加到 `evidenceJson.adminGovernance.auditLog`。
  - `resolve/assign` 审计记录显式报告 `undoAvailable=false`；本变更不声明风险处置已有回滚端点。
  - `assign` 校验 assignee 存在，并把负责人和审计记录写入 `evidenceJson.adminGovernance`。
- `src/app/api/admin/data-governance/status/route.ts`
  - 当治理深链携带 `riskId` 时，除最新 8 条风险外额外返回 `targetRiskFlag`，避免较早但有效的风险被误判为 missing。
- `src/app/api/admin/data-governance/export/route.ts`
  - 按未解决风险范围生成 JSON、CSV 或 XLSX，返回匹配的 content-type、content-disposition 和 `x-export-filename`。
- `src/features/admin/data-governance-dashboard.tsx`
  - 接收 `action/riskId/assignee/format` 深链参数。
  - 动作解析使用 `targetRiskFlag + recentRiskFlags` 去重集合；导出状态文案与服务端未解决风险范围一致。
  - 风险列表增加行级“处置”和“分派”按钮，按钮调用治理动作 API。
  - 页面顶部显示 `ActionStatusPanel` 与动作审计摘要。
  - `action=export` 通过服务端导出端点提供 JSON/CSV/XLSX 下载文件。
- `src/features/admin/system-config-dashboard.tsx`
  - 接收 `provider/model/action=test` 深链参数。
  - 缺失 provider、缺失 model、provider 不存在、model 不存在均显示明确 blocked 状态。
  - 已定位模型显示 pending/succeeded/failed 的模型测试状态。
- `src/features/admin/states/admin-states-dashboard.tsx`
  - 接收 `action=export` 或 `focus=usage-export`。
  - 提供系统使用量 JSON 下载和 export-ready 审计摘要。
- `src/app/globals.css`
  - 管理后台移动端表格被限制在表格容器内横向滚动，页面主体不再被表格撑宽。

## 测试证据

- `rtk npm run test:unit -- src/app/api/admin/users/export/__tests__/route.test.ts 'src/app/api/admin/data-governance/risks/[riskId]/actions/__tests__/route.test.ts' src/app/api/admin/data-governance/export/__tests__/route.test.ts src/features/admin/__tests__/admin-governance-action-contract.test.ts src/features/admin/__tests__/admin-dashboard-api-ui-contract.test.ts src/app/api/admin/users/import/__tests__/route.test.ts`
  - 6 files passed
  - 20 tests passed
- Earlier focused suite also passed before the review fix:
  - `src/app/__tests__/admin-users-api-ui-contract.test.ts`
  - `src/app/api/admin/data-governance/status/__tests__/route.test.ts`
  - `src/app/api/admin/ai-settings/test/__tests__/route.test.ts`
  - `src/features/admin/__tests__/system-config-dashboard-ai-settings.test.ts`
  - `src/features/admin/__tests__/admin-states-dashboard-export.test.ts`
- `rtk npm run lint`
  - passed
- `rtk openspec validate audit-remediation-admin-governance-workflows --strict`
  - passed
- `rtk npx tsc --noEmit --pretty false`
  - failed on pre-existing unrelated files only:
    - `src/app/evaluation/prompt-assessment/page.tsx`
    - `src/app/teacher/classes/[classId]/students/[studentId]/evidence/page.tsx`
    - `src/features/assessment/__tests__/document-rubric-grading-route-state.test.ts`
    - `src/features/interactive/__tests__/interactive-tracking.test.tsx`
    - `src/lib/__tests__/adaptive-learner-state-service.test.ts`
    - `src/lib/__tests__/konling-agent-runtime.test.ts`
    - `src/lib/data-governance/__tests__/learning-evidence-rag-corpus.test.ts`
    - `src/lib/teacher-report-grading-contracts.ts`

## Finding 对应

- 已关闭：257、277、316、318、355、356、357、391、392、404、405、416、417、428、429、430、439、440、441、448、449、450。
- 部分关闭：258、288。258 的预览、确认、失败行导出、通知和批次审计已关闭；自动回滚需要持久 import-batch 存储和专用 rollback endpoint，本变更不再虚假声明已自动回滚。288 的新建账号错误文案未重写，但导出/导入/批次治理链路已补齐。
- 非本变更关闭范围：304、343。数据中心导出与浮层阻断归属数据中心导出修复，不归属管理员治理工作流。
- 历史稳定性复核：289、305、329、341、342。治理页现在保留加载/失败态，并在风险列表上提供对象化入口和深链恢复状态。
