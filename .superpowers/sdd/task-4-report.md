# Task 4 Report: Motion and Inspector Behavior

Status: DONE

## Scope

- Completed OpenSpec tasks 4.1–4.4 only; Task 5 remains untouched.
- Added a keyed bounded-motion contract with 160 ms focus, 220 ms relation, 240 ms local camera, 160 ms collapse, and a 360 ms total reveal ceiling.
- Limited individual node staggering to 24 nodes and assigned larger-shard remainder nodes to one bounded batch.
- Added reduced-motion final-state behavior: zero spatial/stagger/camera duration and no animated 3D semantic particles; static arrows and relation encodings remain.
- Keyed transitions by graph version, target, and generation; newer keys and disposal cancel stale callbacks. Late expansion errors now also obey generation and activation-sequence guards.
- Closed the inspector through renderer blank-background activation and node-drag manipulation starts without altering expansion/cache/layout state.
- Reordered the shared responsive inspector to identity/explanation, Knowledge Card, Related Knowledge Points, then learning/evidence actions.

## TDD Evidence

- RED: `knowledge-graph-motion.test.ts` failed because `graph/motion.ts` did not exist.
- GREEN: motion timing, stagger/batch, reduced-motion, and stale-key cancellation tests pass.
- Mounted behavior coverage proves blank-background and drag dismissal retain expanded and cached state.
- Existing stale target-switch tests exposed late error-state mutation; the generation/sequence guard was added and all focused tests pass.

## Verification

- Focused Vitest: 3 files, 13 tests passed.
- `npm run typecheck`: passed before final verification rerun.
- Touched-file ESLint: zero issues.
- OpenSpec strict validation and final fresh verification are recorded in the final handoff.

## Concerns

- Task 5 browser capture, accessibility/visual review, and Playwright evidence remain intentionally out of scope.
