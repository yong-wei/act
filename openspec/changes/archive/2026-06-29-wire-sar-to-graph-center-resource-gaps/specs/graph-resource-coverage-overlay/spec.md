## ADDED Requirements

### Requirement: Resource coverage overlay can display SAR candidate gaps
The graph resource coverage overlay SHALL display SAR-backed candidate resources as suggestions without treating them as covered resources.

#### Scenario: SAR suggests a resource for a coverage gap
- **WHEN** SAR finds a candidate resource or evidence item for a graph node with missing coverage
- **THEN** the overlay SHALL show the candidate separately from linked, path-eligible, citation-ready, and verified-citation counts
- **AND** it SHALL expose the trace or rationale for teacher/admin review.
