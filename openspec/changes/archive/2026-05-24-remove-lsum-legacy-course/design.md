## Context

The LSUM course was previously kept as a special course while 2-1 and later runtime-first unit courses matured. The user has now declared this route deleted. Retaining its presets or snapshot aliases would keep the course partially alive even if the page route is removed.

## Goals / Non-Goals

**Goals:**

- Remove the LSUM App Router entry, feature implementation, presets, and catalog references.
- Delete or update tests that preserve LSUM as an active special course.
- Ensure classroom session route helpers no longer resolve LSUM as a supported route segment.

**Non-Goals:**

- Do not migrate LSUM content into another course.
- Do not remove shared classroom/session framework code used by active courses.
- Do not alter cruise-comfort behavior in this change.

## Design

1. Start from the route segment `lsum-design-feasible-domain` and remove every active import path that keeps it reachable.
2. Remove preset and AI-context entries rather than keeping hidden compatibility keys.
3. Update tests to assert there is no LSUM catalog item, preset key, AI context key, or session snapshot route alias.
4. Keep 2-1 as the canonical course replacing this retired surface.

## Risks

- LSUM constants may still be used in tests as fixtures. Those tests should move to active unit-course fixtures.

## Verification

- Run focused tests that mention `lsum-design-feasible-domain`.
- Run affected preset/catalog tests.
- Run `npm run lint`.
