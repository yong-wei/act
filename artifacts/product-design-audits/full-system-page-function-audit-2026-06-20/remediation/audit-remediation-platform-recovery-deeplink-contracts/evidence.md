# Audit Remediation Evidence: Platform Recovery Deeplink Contracts

Date: 2026-06-30
Change: `audit-remediation-platform-recovery-deeplink-contracts`
Issue: #728

## Closure Scope

This remediation closes the highest-risk remaining deeplink recovery subset for platform bad routes, Arena bad IDs, Arena publication permission boundaries, and classroom class-code API/UI recovery semantics. It does not claim closure for every legacy route that still calls `notFound()` or every vertical workflow listed in the full audit.

## Closure IDs

| Closure ID | Evidence |
| --- | --- |
| `global-not-found-product-recovery` | `src/app/not-found.tsx` renders a product-owned `ActionStatusPanel` for unknown routes with `invalid-object-route`, dashboard and interactive-learning recovery actions, and `data-platform-route-recovery="global-not-found"`. |
| `arena-challenge-bad-task-recovery` | `src/app/arena/challenges/[taskId]/page.tsx` returns `ArenaRouteRecovery` for unknown task IDs and missing challenge configuration instead of raw `notFound()`. |
| `arena-student-publication-permission-recovery` | `src/app/arena/challenges/[taskId]/page.tsx` maps anonymous, non-student, missing publication, stale publication, task mismatch, and access-denied publication links to explicit recovery categories. |
| `arena-teacher-publication-report-recovery` | `src/app/teacher/arena/publications/[publicationId]/page.tsx` maps missing report and teacher/admin permission boundaries to product recovery states. |
| `class-join-api-recovery-semantics` | `src/app/api/classes/join/route.ts` returns `classJoinState` for invalid, missing, inactive, forbidden, and successful class-code joins. |
| `class-join-ui-recovery-writeback` | `src/app/classroom/join/page.tsx` consumes `classJoinState.recoveryAction` and `classJoinState.evidenceWriteback` so class-code failures and successful bindings are visible in the same recovery surface. |
| `platform-recovery-category-extension` | `src/lib/platform-recovery-contract.ts` adds `stale-object`, `no-match`, and `unsupported-method` recovery kinds for future route/API alignment; concrete class-code join responses consume the aligned API/UI recovery state in this change. |

## Finding Mapping

- Partially closes 266 and 267 for unknown routes, Arena challenge bad IDs, and Arena teacher publication reports by replacing raw default 404 behavior with product recovery panels and primary recovery actions.
- Extends 273, 275, and 276 with shared `ActionStatusPanel` live/status behavior and API/UI class-code recovery semantics.
- Leaves playlist, handout print, classroom runtime session pages, teacher student detail, learning-path bad query, and student evidence lesson filters as residual vertical route work.

## Verification

- `rtk npx vitest run src/lib/__tests__/platform-recovery-contract.test.ts src/app/__tests__/platform-recovery-source.test.ts src/app/__tests__/arena-challenge-page.test.ts src/app/api/classes/join/__tests__/route.test.ts src/features/interactive/__tests__/classroom-join-entry.test.ts src/features/arena/__tests__/arena-publication-report.test.ts`
  - Result: 6 files passed, 40 tests passed.
- `rtk npx eslint src/lib/platform-recovery-contract.ts src/features/arena/arena-route-recovery.tsx 'src/app/arena/challenges/[taskId]/page.tsx' 'src/app/teacher/arena/publications/[publicationId]/page.tsx' src/app/api/classes/join/route.ts src/app/classroom/join/page.tsx src/app/not-found.tsx src/lib/__tests__/platform-recovery-contract.test.ts src/app/__tests__/platform-recovery-source.test.ts src/app/__tests__/arena-challenge-page.test.ts src/app/api/classes/join/__tests__/route.test.ts src/features/interactive/__tests__/classroom-join-entry.test.ts src/features/arena/__tests__/arena-publication-report.test.ts --max-warnings=0`
  - Result: passed.
- `rtk npm run lint`
  - Result: passed.
- `rtk npx tsc --noEmit --pretty false`
  - Result: failed with existing repository type debt, 79 errors in 22 unrelated files. The captured log did not include files touched by this change.

## Residual Scope

- This change does not batch-convert all `notFound()` callers. Remaining classroom runtime, playlist, handout print, teacher student, learning-path, and evidence-filter route failures need their own domain-specific recovery copy and tests.
- This change does not introduce a global API response rewrite or claim concrete unsupported-method closure for every route. Existing admin users no-match and unsupported-action contracts remain covered by `audit-remediation-api-ui-contracts`; this change extends platform recovery categories and class-code join semantics.
