## Why

Manifest objective scoring is split between frontend submission telemetry and
server-side LearningFact materialization. Multi-select, ordering, and matching
questions can be misclassified when scoring depends on exact text equality or
submitted pair order.

## What Changes

- Add a shared manifest objective scorer used by frontend telemetry and server
  fact materialization.
- Support single choice, boolean, multi-select, ordering, and matching
  objectives.
- Emit normalized answers, score, correctness, partial-credit detail, and a
  scoring version.
- Compare matching answers structurally as pair sets, independent of submitted
  pair order.

## Capabilities

### New Capabilities
- `manifest-objective-scoring`: Defines shared objective scoring semantics for
  manifest-driven interactive lessons.

### Modified Capabilities
- None.

## Impact

- Affects manifest runtime submission telemetry, interaction event payloads,
  StudentStepResponse scoring context, and LearningFact materialization.
- Does not perform historical re-scoring. That is handled by
  `recompute-interactive-evidence-scoring-history`.
