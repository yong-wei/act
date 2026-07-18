## Design Notes

The portrait update engine should distinguish four concepts:

- `score`: long-term learner state for a portrait dimension.
- `confidence`: strength and consistency of evidence supporting the score.
- `freshness`: how recent the supporting evidence is.
- `trend`: short-term movement compared with prior portrait state.

The worker should load the previous portrait v2 state and apply a delta from
new or newly relevant evidence. Dimensions with no new evidence should preserve
their previous score. Their confidence or freshness may decay according to a
documented policy, but the score must not become zero solely because evidence
aged out of a fixed window.

Negative evidence can reduce a score when the evidence explicitly indicates
failure, misconception, unsafe action, or poor quality. Sparse context-only
facts, path selection facts, or facts with no profile contribution should not
overwrite dimensions.

## Update Semantics

Implementation agents may choose the exact formula, but it must satisfy these
invariants:

- no evidence: preserve score, reduce freshness/confidence only if policy says
  so
- new positive evidence: increase or reinforce affected dimensions
- new partial evidence: gently adjust affected dimensions and record limitation
- new negative evidence: reduce affected dimensions with bounded delta and
  rationale
- unrelated evidence: do not change untouched dimensions
- unknown dimension: report mapping issue; do not silently discard if the
  primary model expects it

## Verification Strategy

- Unit tests for no-new-evidence preservation.
- Unit tests for sparse path-selection facts not collapsing the portrait.
- Unit tests for negative evidence bounded decreases.
- Worker tests showing latest portrait state remains stable across hourly runs.
