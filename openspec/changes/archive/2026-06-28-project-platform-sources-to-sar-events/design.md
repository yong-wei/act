## Design

Projection is deterministic and metadata-driven. Each projection builder accepts governed platform records and returns SAR events, entities, relations, and limitations. It must not read raw Markdown, media bytes, hidden Arena internals, or raw student submissions directly.

## Source Families

- K/A/Q graph and objective catalogs produce graph/objective/portrait events and entities.
- LearningGoal and ExpandedGoalSubgraph produce goal, target graph node, prerequisite, checkpoint, and terminal validation entities.
- ResourceNode registry and ResourceSemanticProjection produce resource, segment, citation target, retrieval chunk, and planning unit events.
- LearningEvidenceCorpusChunk produces retrieval evidence events using redacted summaries and citation target refs where available.
- LearningFact, grading, simulation, Arena, path, diagnosis, teacher report, Konling, and prep-pack records produce summary events only when governed summaries exist.

## Shared Coverage Boundary

Graph Center already computes resource coverage using graph refs, ResourceNode metadata, and evidence corpus chunks. This change should extract reusable matching helpers or otherwise consume the same matching logic so SAR projections and Graph Center overlays do not maintain separate resource-recognition rules.

## Privacy

Student-visible projection must include only public, student-visible, or authorized redacted summaries. Teacher-scoped and audit-only records remain scoped and must carry limitations.
