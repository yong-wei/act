## Context

Teacher and admin pages have been migrated toward dark operations surfaces, but they often remain home-card directories. The redesign should make them operating desks: what needs attention, what is active, what is blocked, and where to continue.

## Goals / Non-Goals

**Goals:**

- Build a continuous teacher operations shell.
- Build a continuous admin governance shell.
- Make future/unavailable analytics honest and action-oriented.
- Ensure mobile operations navigation is explicit.

**Non-Goals:**

- Do not change role permissions.
- Do not fabricate analytics or governance data.
- Do not implement report export surfaces here.

## Decisions

### Decision 1: Operations homepages are not directories

Teacher/admin homepages should prioritize current work, risks, and pending decisions before navigation cards.

### Decision 2: Unavailable capabilities are designed states

Feature-flagged or unavailable analytics should explain why they are unavailable and where the user can continue, instead of filling space with passive placeholders.

## Risks / Trade-offs

- Operations pages are data-heavy. -> Use dense but consistent table/filter/action patterns.
- Admin and teacher roles differ. -> Use one archetype with role-specific navigation and vocabulary.
