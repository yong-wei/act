# audit-remediation-authoring-api-task-consumption-closure Evidence

Date: 2026-07-02

Change: `audit-remediation-authoring-api-task-consumption-closure`
Issue: #754

## Scope

This change closes finding 371 for API-backed authoring task consumption only.

Covered surfaces:

- lesson plans from `/api/lesson-plans`
- teaching resources from `/api/resources`
- ResourceNodes from `/api/teacher/resource-nodes`
- knowledge nodes from `/api/knowledge/nodes`

Out of scope and not re-closed here:

- playlist save/play recovery
- knowledge graph filter controls
- mobile playlist builder structure
- authoring button-name polish

Those areas remain covered by `audit-remediation-authoring-knowledge-flow-polish`.

## Closure Evidence

### Task Contract

Files:

- `src/lib/authoring-api-task-consumption.ts`
- `src/lib/__tests__/authoring-api-task-consumption.test.ts`

Contract:

- `AUTHORING_API_TASK_STATUSES` covers `available`, `disabled`, `pending`, `saved`, `failed`, `rolled-back`, and `not-reversible`.
- Task reasons cover missing metadata, invalid references, blocked ResourceNode state, permission, and unsupported rollback.
- Object-specific builders map lesson plans, teaching resources, ResourceNodes, and knowledge nodes to task records.

### UI Consumption

Files:

- `src/features/lesson-engine/lesson-plan-list.tsx`
- `src/features/teacher/resources/interactive-resource-list.tsx`
- `src/features/teacher/resources/classroom-component-list.tsx`
- `src/features/teacher/resources/teacher-resource-node-management.tsx`
- `src/features/teacher/resources/knowledge-node-manager.tsx`
- `src/features/teacher/resources/authoring-api-task-strip.tsx`

DOM evidence:

- `data-authoring-api-task-surface`
- `data-authoring-api-task-count`
- `data-authoring-api-task-type`
- `data-authoring-api-task-state`
- `data-authoring-api-task-reason`

The task strip exposes API records as edit, validation, preview, attach, inspect, blocked-state recovery, cite, save, and rollback/non-reversible tasks rather than leaving them as inert long lists.

### Audit Mapping

Files:

- `artifacts/product-design-audits/full-system-page-function-audit-2026-06-20/report.md`
- `src/app/__tests__/authoring-resource-flow-source.test.ts`

Finding 371 is closed for API-consumption taskization. The source test asserts that the report does not re-close playlist save/play, graph filter, mobile builder, or button-name scope.

## Verification

Commands run:

```bash
rtk npm run test:unit -- src/lib/__tests__/authoring-api-task-consumption.test.ts src/app/__tests__/authoring-resource-flow-source.test.ts src/features/teacher/__tests__/teacher-resource-node-management-component.test.ts
rtk npm run test:unit -- src/lib/__tests__/authoring-api-task-consumption.test.ts src/app/__tests__/authoring-resource-flow-source.test.ts src/features/teacher/__tests__/teacher-resource-node-management-component.test.ts src/lib/__tests__/teacher-resource-node-management.test.ts
rtk openspec validate audit-remediation-authoring-api-task-consumption-closure --strict
rtk proxy git diff --check
rtk npm run lint
```

Results:

- Initial targeted Vitest run: 15 passed, 1 failed before report/evidence backfill.
- Final targeted Vitest run: 4 files passed, 31 tests passed.
- OpenSpec validation: valid.
- Diff whitespace check: passed.
- ESLint: passed with `--max-warnings=0`.
