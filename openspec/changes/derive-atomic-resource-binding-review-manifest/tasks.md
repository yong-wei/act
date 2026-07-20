## 1. Implement atomic resource queue derivation

- [ ] 1.1 Add the new read-only manifest CLI with all twelve entity types and recursive non-overlapping leaf segmentation, including whole-document `teaches` fallback.
- [ ] 1.2 Emit exactly-once `atomic_unit` records with closed audience/visibility separately from zero-to-many `binding_candidate` records keyed by `(atomic_unit_id, component_id, role)`; exclude teacher-only units from all student-facing projections.
- [ ] 1.3 Use only `teaches`, `practices`, `assesses`, and `references` with role-specific evidence schemas; apply the source-role matrix so plans/reviews/projections cannot directly bind; resolve and align objective refs; validate closed feedback and teacher-progression fields; and reconcile interactive authoring, runtime, and hard gates field by field.
- [ ] 1.4 Keep unresolved boundaries explicit and incomplete; derive container coverage only from atomic children.
- [ ] 1.5 Reconcile authoring/runtime/sequence knowledge-card consistency and multimedia/runtime-media projection consistency, and apply dataset-level privacy minimization.

## 2. Verify the deliverable

- [ ] 2.1 Add wholly synthetic mixed content/activity/checkpoint, nested interactive, long-document fallback, role-evidence, candidate-concept/objective-ref failure or misalignment, assessment criterion/scoring/evidence-source drift, feedback trigger/outcome/correction/next-task gaps, progression hold/release/retry/override gaps, BOPPPS-teacher-prose rejection, teacher-audience exclusion, source-role glob hit/unclassified/overlap coverage, raw/processed/runtime media roles, canonical-card/sequence/runtime reconciliation, drag/link/exploration degradation, duplicate-prompt, missing-feedback, runtime field drift/hard-gate blocking, multi-role cardinality, unresolved-role, entity, container, endpoint, card/media-consistency, and privacy fixtures.
- [ ] 2.2 Add a fixed real-snapshot integration test that reports observed counts as evidence.
- [ ] 2.3 Prove byte-identical repeated runs and no writes.
