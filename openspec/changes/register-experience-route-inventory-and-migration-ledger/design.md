## Context

Existing `DEFAULT_COMMERCIAL_VISUAL_ACCEPTANCE_ROUTES` covers representative routes, not all primary pages. The new UI series requires a stronger source of truth so every route either conforms, has an owning migration change, or has a temporary exception.

## Goals / Non-Goals

**Goals:**

- Produce a durable route ledger for the whole redesign series.
- Assign cross-cutting routes to exactly one owning migration.
- Provide machine-readable inputs for visual QA and governance.

**Non-Goals:**

- Do not migrate UI in this change.
- Do not create new business routes.

## Decisions

### Decision 1: Ownership is explicit

Each route belongs to one owning change even when it appears in multiple product contexts. Other changes can depend on or reference it, but cannot silently change its shell or visual language.

### Decision 2: Representative matrix and full ledger are separate

Visual QA can keep a smaller representative screenshot matrix, but route conformance checks must know the full primary route ledger.

## Risks / Trade-offs

- Full inventory can become stale. -> Add tests that compare inventory coverage against known primary `src/app/**/page.tsx` patterns.
- Ownership may slow parallel work. -> Use coupling groups and dependencies for overlapping route families.
