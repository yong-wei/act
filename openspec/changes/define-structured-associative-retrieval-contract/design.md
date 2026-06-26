## Design

SAR is a governed associative layer over existing platform truth. It stores references and safe summaries, not raw source content. Its contracts must be usable by Source Pack retrieval, Konling grounding, Graph Center overlays, path planning, and diagnostics without making any one consumer the owner.

## Core Types

- `SarRetrievalEvent`: a semantic event such as graph node, resource node, corpus chunk summary, learning fact summary, grading artifact, simulation summary, Arena summary, path summary, diagnosis summary, teacher report, Konling memory summary, or prep-pack item.
- `SarRetrievalEntity`: a stable platform entity such as LearningGoal, K/A/Q objective, graph node, portrait dimension, ResourceNode, PlanningUnit, path node, LearningFact, rubric criterion, citation target, student, or class.
- `SarRetrievalEventEntity`: relation from event to entity with role, confidence, and source.
- `SarRetrievalTrace`: seed entities, expansion hops, selected/rejected refs, limitations, and version refs.

## Boundaries

- SAR events must include `sourceRef`, `sourceOwner`, authority, privacy scope, freshness, and content hash where available.
- SAR entities must prefer platform stable ids; LLM-extracted entities are allowed only as lower-confidence, explicitly marked candidates.
- Restricted raw content, hidden Arena internals, private Konling memory, and raw learner submissions must not be embedded in SAR events.
- Citation verification and CitationChip payload construction remain owned by LearningEvidence/Source Pack citation layers.
- SAR must not automatically write dynamic associations back to the K/A/Q graph.
