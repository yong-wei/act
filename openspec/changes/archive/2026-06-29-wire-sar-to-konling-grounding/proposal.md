## Why

Konling already has server-owned grounding context, CitationChip metadata, and Source Pack planning. It still lacks a governed way to explain multi-hop relationships around the selected graph node, LearningGoal, path node, resource, and learner state. SAR can provide that association trace while Source Pack remains responsible for final evidence pack and citations.

## What Changes

- Add SAR-associated grounding context to Konling runtime.
- Add a scoped `search_associated_learning_evidence` style tool or internal service call for eligible Konling modes.
- Feed SAR candidate refs into Source Pack retrieval where verified evidence is needed.
- Store simplified trace/limitations in assistant metadata without leaking private diagnostics to students.

## Impact

- Extends `structured-associative-retrieval`.
- Extends `konling-agent-runtime`.
- Depends on SAR association expansion and Source Pack consumer/citation changes.
