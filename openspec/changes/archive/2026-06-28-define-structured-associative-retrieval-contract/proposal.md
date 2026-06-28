## Why

ACT already has K/A/Q graph, LearningGoal packages, ResourceNode/PlanningUnit governance, LearningEvidence RAG corpus, Source Pack planning, and CitationChip verification. What is missing is a small, governed event/entity layer that can connect these stable identifiers at query time without polluting the canonical graph or bypassing citation verification.

## What Changes

- Define SAR as ACT's structured associative retrieval layer.
- Add core contracts for retrieval events, entities, event-entity relations, query traces, and result summaries.
- Require platform stable ids before LLM-extracted entities.
- Forbid raw restricted content in SAR events.
- Preserve the boundary that verified citations are resolved by Source Pack/LearningEvidence/CitationChip, not authored by SAR.

## Impact

- New capability: `structured-associative-retrieval`.
- Proposed modules: `src/lib/data-governance/structured-associative-retrieval-types.ts`, `structured-associative-retrieval.ts`, and focused contract tests.
- No database migration in this first change.
