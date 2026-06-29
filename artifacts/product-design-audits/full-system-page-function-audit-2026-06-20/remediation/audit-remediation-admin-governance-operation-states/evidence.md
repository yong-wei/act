# audit-remediation-admin-governance-operation-states 证据

日期：2026-06-29
Issue：#726
Change：`audit-remediation-admin-governance-operation-states`

## 覆盖范围

- 管理员用户导入、失败行下载、搜索筛选、空结果导出：`/admin/users`
- 管理员配置保存与模型测试：`/admin/config`
- 数据治理刷新、处置、分派、导出：`/admin/data-governance`
- 管理员移动端表格卡片化与横向溢出约束

## 代码证据

- `src/features/admin/admin-dashboard.tsx`
  - 用户导入失败行下载改为异步 server artifact 下载路径。
  - 下载响应读取 `x-admin-operation-id`、`x-admin-operation-idempotency-key`，并显示可审计 `ActionStatusPanel`。
  - 无 server artifact 的本地 CSV fallback 明确标记为本地导出状态，不伪造服务端账本。
- `src/app/api/admin/operations/artifacts/[artifactId]/route.ts`
  - 失败行 artifact 下载已写入 `admin-import-failed-rows-download` 操作账本，并返回操作头。
- `src/app/api/admin/data-governance/risks/[riskId]/actions/route.ts`
  - `resolve` / `assign` 成功后写入 `admin-governance-resolve` / `admin-governance-assign` 操作账本。
  - 响应体返回 `operationLedger`，响应头返回 `x-admin-operation-*`。
  - `auditRecord` 带上 `operationId`、`idempotencyKey`、`retentionPolicy`，与持久账本一致。
- `src/features/admin/data-governance-dashboard.tsx`
  - 治理动作成功后优先使用服务端 `operationLedger` 生成状态面板。
  - 页面继续展示动作审计中的操作 ID、去重键和保留策略。
- `src/lib/admin-operation-ledger.ts`
  - 管理员操作账本类型新增 `admin-governance-resolve`、`admin-governance-assign`。
- `src/app/globals.css`
  - `admin-console-table[data-admin-mobile-cards="true"]` 在窄屏下转为卡片式行布局，避免管理表格撑宽页面。

## 验证证据

- `rtk npx vitest run 'src/app/api/admin/data-governance/risks/[riskId]/actions/__tests__/route.test.ts' src/features/admin/__tests__/admin-governance-action-contract.test.ts src/features/admin/__tests__/admin-dashboard-api-ui-contract.test.ts 'src/app/api/admin/operations/artifacts/[artifactId]/__tests__/route.test.ts' src/app/api/admin/users/import/__tests__/route.test.ts src/app/api/admin/users/export/__tests__/route.test.ts src/app/__tests__/admin-users-api-ui-contract.test.ts`
  - 7 files passed
  - 43 tests passed
- `rtk npx eslint 'src/app/api/admin/data-governance/risks/[riskId]/actions/route.ts' 'src/app/api/admin/data-governance/risks/[riskId]/actions/__tests__/route.test.ts' src/features/admin/data-governance-dashboard.tsx src/features/admin/__tests__/admin-governance-action-contract.test.ts src/features/admin/admin-dashboard.tsx src/features/admin/__tests__/admin-dashboard-api-ui-contract.test.ts src/lib/admin-operation-ledger.ts --max-warnings=0`
  - passed
- `rtk openspec validate audit-remediation-admin-governance-operation-states --strict`
  - valid
- `rtk env PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npx playwright test tests/mobile-a11y-shell.spec.ts -g 'admin mobile pages keep 320px and 390px document width with announced table states'`
  - 1 passed
  - 证据文件：
    - `playwright/admin-users-320-dom-width.json`
    - `playwright/admin-users-390-dom-width.json`
    - `playwright/admin-data-governance-320-dom-width.json`
    - `playwright/admin-data-governance-390-dom-width.json`
    - `playwright/admin-users-320.png`
    - `playwright/admin-users-390.png`
    - `playwright/admin-data-governance-320.png`
    - `playwright/admin-data-governance-390.png`

## Finding 对应

- 管理员治理处置与分派：治理 API 与 UI 现在具备持久操作账本、响应头、可见状态与恢复动作。
- 用户导入失败行下载：下载动作具备独立服务端账本与可见下载状态。
- 用户搜索、筛选、导入、导出、配置保存、模型测试、治理导出：相关 API/UI 契约由既有实现与本次回归测试覆盖。
- 管理员移动端：用户与治理表格使用移动卡片模式，源代码契约测试覆盖 `data-admin-mobile-cards="true"`。
