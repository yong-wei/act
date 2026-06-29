## ADDED Requirements

### Requirement: Konling grounding includes structured associative context
Konling runtime SHALL include structured associative context when SAR association expansion is available for the current mode and scope.

#### Scenario: Scoped learning question is answered
- **WHEN** Konling answers a graph, path, resource, diagnosis, grading, or prep-pack question with available SAR context
- **THEN** the runtime SHALL include SAR seed refs, associated event refs, trace summary, candidate evidence refs, and limitations in server-owned metadata
- **AND** final citations SHALL still be rendered from verified CitationChip or Source Pack citation metadata.
