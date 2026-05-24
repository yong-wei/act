## Context

The current course model uses route segments under `/interactive-learning/courses/*`, classroom sessions, runtime lesson manifests, and shared governance adapters. The old `lesson-*` pages are not part of that model and should not remain as alternate student-facing entry points.

## Goals / Non-Goals

**Goals:**

- Delete the retired one-page route directories that still exist under `src/app/interactive-learning/`.
- Remove catalog and test expectations that advertise those pages.
- Add a small route/catalog guard so the retired surface cannot quietly return.

**Non-Goals:**

- Do not delete canonical unit course implementations under `src/features/interactive/unit-*`.
- Do not rewrite course content, manifests, or governance adapters in this cleanup change.
- Do not modify `/interactive-learning/courses/cruise-comfort-boppps` or `/interactive-learning/courses/lsum-design-feasible-domain`; those are handled by later issues in this series.

## Design

1. Treat `src/app/interactive-learning/lesson-*` as the removal boundary.
2. Remove route imports, redirects, generated metadata, or tests that are only needed for those retired pages.
3. Keep canonical course route segments and `FEATURED_LESSONS` entries for active runtime-first unit courses.
4. Add or update a focused test that scans the App Router and catalog for retired `/interactive-learning/lesson-` links.

## Risks

- Some tests may still use old routes as fixtures. Those tests should move to canonical unit course routes rather than keeping compatibility redirects.

## Verification

- Run the focused interactive catalog/route tests affected by the deletion.
- Run `npm run test:course-data-quality-gates` if the catalog inventory or governance tests are touched.
- Run `npm run lint`.
