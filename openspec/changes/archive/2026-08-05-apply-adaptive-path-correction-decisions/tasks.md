## 1. Decision persistence and server contract

- [x] 1.1 Add an append-only correction-decision model, Prisma migration, and generated-client coverage.
- [x] 1.2 Implement server-authoritative candidate fingerprinting, snapshots, idempotency, and stale-write protection.
- [x] 1.3 Add an authorized correction-decision route that confirms, rejects, or defers a candidate without accepting client path content.

## 2. Path application and journey projection

- [x] 2.1 Apply confirmed candidates only to eligible future unfinished nodes while preserving entered and completed execution state.
- [x] 2.2 Extend the journey projection with candidate fingerprint, path version, decision state, and privacy-safe decision history.
- [x] 2.3 Add focused unit and route tests for decision lifecycle, idempotency, stale candidates, and concurrent writes.

## 3. Student decision controls

- [x] 3.1 Render confirm, reject, and defer controls only for an undecided current candidate.
- [x] 3.2 Render authoritative success, rejection, deferral, conflict-refresh, and decision-history states.
- [x] 3.3 Add UI regression tests covering actionable, rejected, and stale-candidate states.

## 4. Verification and delivery

- [x] 4.1 Run targeted tests, typecheck, required lint, strict OpenSpec validation, and `git diff --check`.
- [x] 4.2 Run the issue worktree locally and capture desktop and 320px browser evidence for confirmation and stale-candidate recovery.
- [x] 4.3 Complete an independent review, commit the verified change, push the dedicated branch, and create the P2 pull request without requesting Codex review.
