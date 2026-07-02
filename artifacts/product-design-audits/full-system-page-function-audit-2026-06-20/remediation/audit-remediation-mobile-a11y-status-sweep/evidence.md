# audit-remediation-mobile-a11y-status-sweep Evidence

Date: 2026-06-30
Change: `audit-remediation-mobile-a11y-status-sweep`
Issue: #729

## Scope

This sweep closes only the horizontal mobile/accessibility evidence gap left after
the dependent vertical remediations. It does not introduce a new UI primitive and
does not claim closure for business states that still lack a domain action,
recovery state, writeback, or download contract.

## Dependency Gate

The required vertical changes are present on the integration baseline used for
this capture:

- `audit-remediation-teacher-classroom-review-delivery-closure`
- `audit-remediation-student-path-evidence-loop-closure`
- `audit-remediation-admin-governance-operation-states`
- `audit-remediation-arena-submission-report-evidence-closure`
- `audit-remediation-platform-recovery-deeplink-contracts`
- `audit-remediation-authoring-knowledge-flow-polish`

## Horizontal Evidence

The sweep reused the archived mobile shell Playwright contract and recaptured it
on the current `dev2` worktree at `2026-06-30T09:14Z`.

Command:

```bash
rtk env PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npx playwright test tests/mobile-a11y-shell.spec.ts
```

Result:

- 2 Playwright tests passed.
- Admin users and admin governance pages kept 320px and 390px document width.
- Teacher report and teacher class detail pages kept 320px and 390px document width.
- Admin create/reset-password dialogs, teacher start-class dialog, and Global AI sidebar preserved focus containment, Escape close behavior, and opener focus restoration.
- Status/live regions remained present for audited admin, governance, teacher report, and teacher class detail surfaces.

Evidence files:

- `remediation/audit-remediation-mobile-a11y-shell/playwright/admin-users-320-dom-width.json`
- `remediation/audit-remediation-mobile-a11y-shell/playwright/admin-users-390-dom-width.json`
- `remediation/audit-remediation-mobile-a11y-shell/playwright/admin-data-governance-320-dom-width.json`
- `remediation/audit-remediation-mobile-a11y-shell/playwright/admin-data-governance-390-dom-width.json`
- `remediation/audit-remediation-mobile-a11y-shell/playwright/teacher-report-320-dom-width.json`
- `remediation/audit-remediation-mobile-a11y-shell/playwright/teacher-report-390-dom-width.json`
- `remediation/audit-remediation-mobile-a11y-shell/playwright/teacher-class-detail-320-dom-width.json`
- `remediation/audit-remediation-mobile-a11y-shell/playwright/teacher-class-detail-390-dom-width.json`
- `remediation/audit-remediation-mobile-a11y-shell/playwright/admin-users-dialog-keyboard-320.json`
- `remediation/audit-remediation-mobile-a11y-shell/playwright/global-ai-sidebar-keyboard-320.json`
- `remediation/audit-remediation-mobile-a11y-shell/playwright/teacher-class-dialog-keyboard-320.json`

## Closure Mapping

- Closes the horizontal portion of 297, 307, 319, 332, 344, 359, 393, and 418
  where the archived mobile shell evidence plus the current recapture prove
  viewport width, fixed primary action reachability, status/live presence, or
  focus containment for the audited representative pages.
- Extends 333, 345, 360, 394, and 419 only for the representative surfaces whose
  vertical behavior now has evidence in the dependent changes. The broad
  "all states lack alert/live" findings remain residual for any surface not
  named by a vertical evidence file.
- Carries forward #726 evidence for admin governance/user operation status and
  mobile table cards, #724 evidence for teacher report/classroom mobile primary
  actions, #725 evidence for adaptive path recovery status, #727 evidence for
  Arena report mobile action reachability, #728 evidence for recovery panels,
  and #730 evidence for authoring/knowledge status regions.

## Residual Scope

- This sweep does not close every historical status/live aggregate. Findings
  that combine many unrelated pages remain open for pages without explicit
  vertical evidence.
- It does not add screenshots for every authoring, AI, data-center, scoring, or
  evidence detail page; source-contract or targeted-test evidence in the
  dependent changes remains the authority for those vertical closures.
- It does not replace domain recovery copy, scoring workflows, governance
  mutation semantics, or download contracts.

## Validation

- `rtk env PLAYWRIGHT_SKIP_WEB_SERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npx playwright test tests/mobile-a11y-shell.spec.ts`
  - 2 passed.
