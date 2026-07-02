## Why

The SAR contract is only useful if existing governed platform sources can be projected into events and entities consistently. ACT already has K/A/Q catalogs, LearningGoal subgraphs, ResourceNode projections, LearningEvidence corpus chunks, learner facts, diagnosis, grading, simulation, Arena, path, and teacher report summaries. Projection should reuse those governed sources rather than scanning raw authoring files or duplicating Graph Center coverage logic.

## What Changes

- Add SAR projection builders for K/A/Q graph, LearningGoal, ResourceNode, LearningEvidence corpus, and governed learner/evaluation summaries.
- Extract or reuse shared graph/resource coverage matching so SAR and Graph Center do not drift.
- Preserve redacted summaries and source refs instead of raw private content.
- Emit projection diagnostics for missing entity bindings, provisional metadata, or privacy limitations.

## Impact

- Extends `structured-associative-retrieval`.
- Proposed modules: `src/lib/data-governance/sar-projection.ts`, `sar-event-builders.ts`, shared coverage matching helpers, and projection tests.
- Depends on `define-structured-associative-retrieval-contract`.
