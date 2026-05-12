# Arena Review Follow-ups

**Goal:** Resolve the Arena review finding for challenge CTAs, then review each Arena implementation commit with subagents and fix confirmed issues.

**Scope:** Arena feature files, Arena API routes, home entry copy, data-governance event registration, Arena tests, and plan records.

## Subagent Review Coverage

| Plan | Commit | Review Status | Main Findings | Resolution |
| --- | --- | --- | --- | --- |
| A | `2f91b0c8` | Reviewed | Home matrix copy still said three modules; CTA already links to detail route. | Fixed copy to four core entries; added static guard. |
| B | `2db775e9` | Reviewed | Hall card title used object name; homework filtering used display text; teacher policy compatibility missing. | Task title is primary; homework filters use structured fields; policy compatibility checks added. |
| C | `14ee3e60` | Reviewed | CTA route guard not in default test gate; future workspace mode mapping risk. | Arena route/home static tests now run in `npm run test`; current seed workspace remains covered. |
| D | `a3b74599` | Reviewed | Stability, control-energy hard constraint, malformed params, NaN metrics, and geometric score floor defects. | Added Hurwitz stability check, strict param validation, control-energy hard limit, finite invalid metrics, and zero-satisfaction score behavior. |
| E | `f20638a2` | Reviewed | Evaluate API auth/error boundary, duplicate reuse, event registration, tie-breakers, hash strength, and overclaimed submission UI. | Added auth/error boundary, route-level duplicate cache, core event registration, policy tie-breakers, SHA-256 artifact hashes, and clearer local preview wording. |
| F | `2c678431` | Reviewed | Teacher API auth/class ownership/input validation missing; page was static; visibility-policy mismatch allowed. | Added TEACHER/ADMIN gate, class ownership check, runtime guards, dynamic route guard, real form state, API preview request, and compatibility tests. |

## Verification

- `rtk npm run test:unit -- src/features/interactive/__tests__/nextjs-dynamic-error.test.ts src/features/arena/__tests__/arena-whitebox-evaluation.test.ts src/features/arena/__tests__/arena-filtering.test.ts src/features/arena/__tests__/arena-domain.test.ts src/features/arena/__tests__/arena-teacher-config.test.ts src/features/arena/__tests__/arena-leaderboard.test.ts src/app/api/arena/evaluate/__tests__/route.test.ts src/app/api/teacher/arena/preview/__tests__/route.test.ts` -> 8 files, 32 tests passed.
- `rtk node scripts/tests/test-arena-home-entry.mjs` -> passed.
- `rtk node scripts/tests/test-arena-routes.mjs` -> passed.
- `rtk npm run test` -> smoke test plus Arena home/routes guards passed.
- `rtk npm run lint` -> passed.
- `rtk npm run build` -> passed.
- `rtk npm run test:unit` -> 101 files and 713 tests passed; 2 existing interactive tests failed outside Arena scope:
  - `src/features/interactive/__tests__/lesson-entry-knowledge-map.test.ts`
  - `src/features/interactive/__tests__/unit-3-3-course.test.ts`

## Completion

- Confirmed original review issue: Arena hall `查看挑战` is a real `Link` to `/arena/challenges/${challenge.id}` and has a default test guard.
- Confirmed all six Arena implementation commits received independent subagent review.
- Confirmed all accepted Arena findings are fixed or explicitly narrowed to current-stage preview semantics.
