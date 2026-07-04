## ADDED Requirements

### Requirement: Long-form planning units retain chunk-level citation support
The governed RAG corpus SHALL preserve citation support for textbook and reference chunks used by reviewed section-level PlanningUnits.

#### Scenario: Section is selected in a path
- **WHEN** a reviewed textbook or reference section is selected as a path resource
- **THEN** related chunks, figures, anchors, and citation targets SHALL remain available for Konling explanations and path rationale
- **AND** citation verification SHALL resolve through server-owned CitationAddress metadata.
