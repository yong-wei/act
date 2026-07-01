## Evidence

### Scope

- GitHub issue: #752
- Change: `audit-remediation-admin-risk-governance-workflow-closure`
- Closed audit findings: 305, 329, 342 for row-level admin risk governance only.
- Excluded residual scope: import/config/export/no-match/mobile table/mobile width/bulk disposition findings already covered by or reserved for other changes.

### Implementation Evidence

- `src/features/admin/admin-governance-action-contract.ts`
  - Defines risk action contract for `assign`, `resolve`, `ignore`, `reopen`, and `undo`.
  - Distinguishes missing risk, missing assignee, already handled, already open, unsupported, pending, and export-ready states.
  - Carries safe labels, affected object labels, evidence hrefs, assignment state, disposition status, and audit trail metadata.
- `src/app/api/admin/data-governance/status/route.ts`
  - Returns requested `riskId` by id without filtering out resolved risks, so URL intents can show already-handled recovery.
  - Maps risk payloads with `safeLabel`, `affectedObjectLabel`, `evidenceHref`, `currentAssignee`, `dispositionStatus`, and `auditTrail`.
- `src/app/api/admin/data-governance/risks/[riskId]/actions/route.ts`
  - Persists `assign`, `resolve`, `ignore`, `reopen`, and `undo` actions.
  - Records actor, previous state, new state, note, affected object, idempotency key, operation id, retention policy, and operation ledger.
  - Converts stale or invalid action state to explicit conflict responses instead of silently mutating data.
- `src/features/admin/data-governance-dashboard.tsx`
  - Adds the `risks` tab intent path.
  - Renders row-level evidence action, assignment state, disposition actions, reversible actions, and audit-trail inspection.
  - Uses blocked recovery for already-handled 409 responses.

### Validation

Targeted admin risk-governance tests passed:

```text
rtk npx vitest run src/features/admin/__tests__/admin-governance-action-contract.test.ts src/app/api/admin/data-governance/status/__tests__/route.test.ts 'src/app/api/admin/data-governance/risks/[riskId]/actions/__tests__/route.test.ts'
```

Result:

```text
Test Files  3 passed (3)
Tests  38 passed (38)
```

Representative DOM/source evidence is covered by `src/features/admin/__tests__/admin-governance-action-contract.test.ts` string assertions for:

- `initialActionQuery?.tab === 'risks'`
- `data-admin-risk-governance-row`
- `data-admin-risk-governance-evidence`
- `data-admin-risk-governance-evidence-state`
- `data-admin-risk-governance-assignment`
- `data-admin-risk-governance-disposition-action="ignore"`
- `data-admin-risk-governance-disposition-action="reopen"`
- `data-admin-risk-governance-disposition-action="undo"`
- `data-admin-risk-governance-audit`
