## Context

Operations and report pages need a quiet, dense, utilitarian shell. The target is not a marketing-style dashboard; it is a repeated-use workspace where teachers and administrators can move from current object to evidence, intervention, review, and export.

## Goals / Non-Goals

**Goals:**

- Migrate teacher layout, teacher analytics, grading workbench, prep-pack overlay, admin governance, and effect report representative surfaces.
- Separate operations-console routes from report-ledger routes in the route ledger.
- Preserve role navigation, object context, evidence status, review actions, export readiness, and privacy labels.
- Represent unavailable analytics or governance data honestly.

**Non-Goals:**

- Implementing runtime overlay data models.
- Implementing assistant effect metrics.
- Replacing teacher/admin authorization or governance rules.

## Decisions

### Decision 1: Operations console is for decisions and repeated actions

Teacher and admin homes should show active work, pending decisions, risks, and next actions before route directory cards.

### Decision 2: Report ledger is for evidence review and export

Report-ledger surfaces should prioritize source labels, privacy boundaries, report status, export actions, and readable metrics. They should not inherit source operational shell ownership unless the ledger declares that relationship.

### Decision 3: Future capabilities render as honest states

When overlay, analytics, model, or effect-report data is not yet implemented, the UI should show unavailable, pending, disabled, or feature-flagged states rather than placeholder metrics.

## Validation

- Representative teacher/admin/report route screenshots cover desktop and 320px mobile.
- Tests verify route-ledger archetype separation between operations-console and report-ledger surfaces.
- Governance checks verify report/export evidence and privacy/status readability.
- `rtk openspec validate migrate-operations-report-ledger-surfaces --strict` passes.
