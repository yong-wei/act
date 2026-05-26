## 1. Shared Scorer

- [x] 1.1 Add a shared manifest objective scorer with versioned result shape.
- [x] 1.2 Implement single choice, boolean, multi-select, ordering, and
  matching scoring.
- [x] 1.3 Keep unsupported or subjective scoring explicit instead of emitting
  misleading zero scores.

## 2. Caller Integration

- [x] 2.1 Use the shared scorer in manifest submission telemetry.
- [x] 2.2 Use the shared scorer in server-side LearningFact materialization.
- [x] 2.3 Preserve raw submitted answers while storing normalized scoring
  context.

## 3. Validation

- [x] 3.1 Add scorer tests for full credit, partial credit, missed options,
  extra options, partial order, and matching pair order independence.
- [x] 3.2 Add integration tests proving frontend telemetry and server
  materialization produce consistent scoring context.
- [x] 3.3 Validate with `rtk openspec validate standardize-manifest-objective-scoring --strict`.
