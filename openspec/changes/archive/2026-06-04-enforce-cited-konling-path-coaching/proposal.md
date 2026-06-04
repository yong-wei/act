## Why

The report identifies Konling as a usable runtime with tools and scoped context, but not yet a path-aware, citation-enforced coaching loop. For control-correction, Konling recommendations, explanations, failure analysis, and Arena correction must cite both content sources and learner/path evidence. Otherwise the agent remains a generic chat assistant and cannot support audited learning-path decisions.

## What Changes

- Enforce path-aware Konling context from server-owned learner state, path round, recent evidence, memory summaries, and permitted tools.
- Add a RAG citation protocol for concepts, personalized recommendations, simulation failure analysis, Arena correction, and teacher-report conclusions.
- Require citation normalization across model providers and citation rendering in student-facing responses.
- Record intervention outcomes and ensure low-confidence evidence is disclosed.

## Capabilities

### Modified Capabilities

- `konling-agent-runtime`
- `evidence-driven-personalization`

## Impact

- Makes Konling coaching traceable and product-grade for control-correction.
- Does not implement provider compatibility itself; that is handled by the later provider-matrix change.
- Requires tests for missing citations, weak evidence, tool scope, and intervention persistence.
