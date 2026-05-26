## 1. Recompute Command

- [x] 1.1 Add dry-run and apply modes for historical manifest objective scoring
  recomputation.
- [x] 1.2 Read immutable StudentStepResponse and InteractionLog evidence as the
  primary answer source.
- [x] 1.3 Stop with a clear diagnostic when scoring rules or lesson identity are
  unavailable.

## 2. Derived Updates

- [x] 2.1 Recompute derived score, correctness, scoring detail, and scoring
  version without overwriting raw submissions.
- [x] 2.2 Repair sourceLogId from sourceEventId when a matching InteractionLog
  exists.
- [x] 2.3 Produce an audit report of old and new scoring context.

## 3. Validation

- [x] 3.1 Add tests for dry-run no-write behavior, idempotent apply, score
  deltas, and sourceLogId repair.
- [x] 3.2 Include lesson 5-3 regression fixtures without hardcoding the command
  to that lesson.
- [x] 3.3 Validate with `rtk openspec validate recompute-interactive-evidence-scoring-history --strict`.
