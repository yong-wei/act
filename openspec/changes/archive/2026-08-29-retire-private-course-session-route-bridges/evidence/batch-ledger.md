# Batch ledger — retire private course session route bridges

Capture tree before deletion: `45086cc56`.  
Pilot receipt: `openspec/changes/archive/2026-08-29-migrate-one-manifest-course-to-shared-classroom-shell/`.

## Batch 1 (this revision)

| Field | Value |
| --- | --- |
| Owner | `retire-private-course-session-route-bridges` |
| Replacement | Shared App Router dispatcher `src/app/interactive-learning/courses/[routeSegment]/{entry,student,teacher,waiting,demo}` plus per-family adapters under `src/features/interactive/course-app-routes/` |
| Public URLs | Unchanged: `/interactive-learning/courses/<routeSegment>/...` |
| Deleted | 32 private App Router families (128 session surfaces + 1-5 demo page) |
| Remaining App Router | Catalog `courses/page.tsx` and one `[routeSegment]` dispatcher tree |
| Unknown / retired slug | `notFound()`; no redirect, no fallback page |
| Title aliases | Still bounded ingress in `interactive-lesson-identity.ts`; they do not choose a private App Router tree |
| `/api/session` | Course adapters and dispatchers do not call it |
| Uppercase renderer | `ResourceRenderer.tsx` and unused `LessonPlayer.tsx` deleted after zero remaining import consumers |

## Consumer-zero evidence

- Filesystem: no `src/app/interactive-learning/courses/<static-family>/` directories remain.
- AST/tests: `retire-private-course-session-route-bridges.test.ts` asserts dispatcher `notFound()`, 32 adapters, identity `routeSegments` coverage, and zero uppercase renderer files/exports.
- Contracts: route ledger `routeFile` values point at the shared dispatcher; representative 1-2/4-1 shell evidence reads adapters.

## Rollback

Restore this change's parent commit. Do not add a live redirect to recover a deleted private tree.

## Browser

Canonical 1-2 entry URL, unknown `routeSegment`, and retired `unit-1-1-laplace-transfer-function` are covered by `tests/retire-private-course-session-route-bridges.spec.ts`. Existing `tests/unit-1-2-shared-classroom-shell.spec.ts` remains the shared-shell journey receipt.
