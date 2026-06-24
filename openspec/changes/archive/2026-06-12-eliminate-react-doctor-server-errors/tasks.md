## 1. Baseline and Triage

- [x] 1.1 Re-run local React Doctor error-only scan and save a filtered baseline for `server-auth-actions`, `nextjs-no-side-effect-in-get-handler`, and `server-no-mutable-module-state`.
- [x] 1.2 Inspect every flagged server action and route handler to classify each finding as authenticated mutation, public read, GET-side effect, request-local calculation, or false positive with evidence.
- [x] 1.3 Map all affected client call sites before changing any GET endpoint method or Server Action signature.

## 2. Server Action Authentication

- [x] 2.1 Add or reuse a narrow authenticated-user helper for Server Actions, preserving existing session semantics.
- [x] 2.2 Harden `src/app/actions/mission.ts` so mission progress actions reject unauthenticated direct calls before reading or mutating state.
- [x] 2.3 Harden `src/app/actions/control-odyssey.ts` so control profile, purchase, upgrade, AI credit, score, AI history, and user-scoped reads enforce the intended authenticated scope.
- [x] 2.4 Add focused tests for unauthenticated rejection, authenticated permitted access, and authenticated cross-user denial for caller-supplied `userId`, `simulationLogId`, history id, or equivalent scope parameters.

## 3. GET Side-Effect Removal

- [x] 3.1 Refactor `src/app/api/ai/sessions/route.ts` so session creation or mutation no longer occurs through GET.
- [x] 3.2 Refactor admin data-governance status and teacher heatmap/insights GET handlers so any accumulator or cache mutation is removed from the GET request path.
- [x] 3.3 Update affected clients and tests for any endpoint method or response-shape changes.
- [x] 3.4 Add route handler tests proving GET requests are side-effect free and mutation paths require the appropriate method and authorization.

## 4. Server Module-State Isolation

- [x] 4.1 Replace mutable module-scope defaults in `src/app/actions/control-odyssey.ts` with immutable constants or request-local factory functions.
- [x] 4.2 Add tests proving request initialization and mutation do not alter shared defaults across users or repeated calls.

## 5. Verification

- [x] 5.1 Run targeted unit/API tests for mission, control odyssey, AI sessions, admin governance status, and teacher heatmap/insights.
- [x] 5.2 Run `npx --yes react-doctor@0.5.1 --no-score --no-telemetry --no-warnings --json .` and confirm no diagnostics remain for the three service-side rules covered by this change.
- [x] 5.3 Run the repository's minimum relevant validation command set and record any unrelated remaining React Doctor error categories for downstream changes.
