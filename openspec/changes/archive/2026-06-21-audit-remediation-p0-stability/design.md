## Context

The audit identifies four P0 groups: short-password registration rendering a Zod error object, zero-item lesson plans launching into `Waiting for content...` and `1 / 0`, teacher projection routes exposing `Not found`, and prep-pack routes returning 500 when backing data or schema is absent. These failures appear in high-value first-mile and teacher workflows, so the remediation must focus on runtime stability before broader workflow redesign.

## Goals / Non-Goals

**Goals:**
- Make audited P0 paths recoverable and user-readable.
- Add validation at both creation and launch boundaries for empty lesson plans.
- Treat missing prep-pack storage/data as an operational state with a recovery path.
- Record exact audit findings as fixed only after the new evidence passes.

**Non-Goals:**
- Do not redesign the whole registration page.
- Do not implement the full prep-pack lifecycle beyond restoring reachable recovery states.
- Do not solve all teacher report, grading, or governance workflows in this change.

## Decisions

- Validation must be layered. Form-level parsing prevents bad registration display; service/server boundaries prevent invalid lesson state from bypassing the UI.
- Runtime projection fixes must be template-wide, not per-screenshot patches, because the audit found the issue across the course family.
- Prep-pack route recovery must distinguish missing migration/table, missing pack, unauthorized class, and no available diagnosis context.
- Audit report updates must use a remediation marker tied to new evidence paths; no item is marked fixed from code review alone.

## Risks / Trade-offs

- Blocking empty lesson plans may reveal existing invalid records. Mitigation: add a non-launchable repair state for existing zero-item plans.
- Prep-pack recovery may depend on database migrations. Mitigation: include readiness checks and a fallback UI state while preserving the migration task.
- Projection route fixes can affect many courses. Mitigation: cover representative course templates and the audited failing examples.
