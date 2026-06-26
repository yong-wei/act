## ADDED Requirements

### Requirement: Konling consumes SAR as grounding association context
Konling SHALL use SAR association expansion as a server-owned grounding enhancement when scoped seed refs are available.

#### Scenario: Konling has graph or path seed refs
- **WHEN** a Konling mode receives LearningGoal, graph node, capability target, resource, path node, citation, learner, or class seed refs
- **THEN** it MAY request SAR association expansion within the mode's role and privacy scope
- **AND** it SHALL receive associated event refs, entity refs, candidate refs, limitations, and trace metadata.

#### Scenario: Konling needs verified evidence
- **WHEN** SAR returns candidate retrieval or citation refs for a factual or personalized answer
- **THEN** Konling SHALL pass those refs to Source Pack or the governed citation layer for verified evidence
- **AND** it SHALL NOT present SAR candidates themselves as verified citations.

### Requirement: Konling SAR trace is privacy-redacted
Konling SHALL expose only safe SAR trace summaries to student-visible responses.

#### Scenario: Student-visible answer uses SAR
- **WHEN** a student-visible Konling answer uses SAR associations
- **THEN** the response metadata or diagnostics SHALL omit raw private evidence, teacher-scoped internals, and audit-only trace details
- **AND** limitations SHALL describe missing or restricted context without revealing private data.
