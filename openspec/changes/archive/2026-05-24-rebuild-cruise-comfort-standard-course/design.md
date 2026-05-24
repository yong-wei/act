## Context

Cruise-comfort is not being removed, but it cannot remain as a special legacy classroom implementation after the unit courses are standardized. The rebuilt course should retain the route and teaching intent while adopting the same manifest, submission, evidence, and finalization boundaries as the new course standard.

## Goals / Non-Goals

**Goals:**

- Keep `/interactive-learning/courses/cruise-comfort-boppps` as the public course route.
- Replace legacy cruise classroom internals with a standard runtime-first course structure.
- Add manifest submission, course evidence spec, data-quality gate coverage, and shared finalization.
- Remove old cruise code that would otherwise keep a second implementation path alive.

**Non-Goals:**

- Do not delete the cruise-comfort route.
- Do not keep a compatibility mode that bypasses the standard adapters.
- Do not change unrelated unit lesson content.

## Design

1. Create or derive a cruise runtime manifest that expresses the existing BOPPPS step flow and response-producing activities.
2. Rebuild the route on the same student/teacher session framework used by standard unit courses.
3. Register cruise-comfort in `CourseEvidenceSpec` and the manifest submission gate inventory.
4. Move student submission to `useManifestSubmissionController`.
5. Move teacher closure to the unified finalization adapter from `unify-interactive-session-finalization`.
6. Remove legacy `cruise-classroom` code once the new route is wired and tests cover the route.

## Risks

- Cruise-comfort has custom assets and AI contexts. The migration must preserve required assets and course identity while deleting only the legacy classroom implementation path.

## Verification

- Run focused cruise-comfort route and classroom tests.
- Run `npm run test:course-data-quality-gates`.
- Run `npm run lint`.
- Run `npm run build` if route-level Next.js behavior or assets are changed.
