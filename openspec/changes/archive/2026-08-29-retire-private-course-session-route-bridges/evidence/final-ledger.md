# Final retirement ledger

Implementation revision is this change's commit on `retire-private-course-session-route-bridges`.
Denominator capture: `45086cc56`.
Pilot: `openspec/changes/archive/2026-08-29-migrate-one-manifest-course-to-shared-classroom-shell/`.

## Zero conditions

| Class | Count | Evidence |
| --- | --- | --- |
| Private App Router course families | 0 | Only `courses/page.tsx` and `[routeSegment]` remain |
| Title-to-private-route bridges | 0 | Identity `routeSegments` are bounded ingress keys, not private trees |
| Direct private `/api/session` producers | 0 | Adapters and dispatchers do not call `/api/session` |
| Uppercase `ResourceRenderer.tsx` consumers | 0 | File deleted; barrel has no forwarding export |

## Replacement

Public URLs stay `/interactive-learning/courses/<routeSegment>/...`.
Unknown and retired slugs use `notFound()` with no redirect.

## Verification

- `openspec validate retire-private-course-session-route-bridges --type change --strict`
- `git diff --check`
- Vitest: retirement, 32 unit-course files, platform contracts, student query boundary, expired-session redirect
- Playwright: `tests/retire-private-course-session-route-bridges.spec.ts`, `tests/unit-1-2-shared-classroom-shell.spec.ts`
- Typecheck: production graph `web` documentation/tooling receipts remain the existing blocked baseline; worker graph passed

Deployment, production activation, and teacher class-choice UX are outside this change.
