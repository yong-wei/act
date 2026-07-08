## ADDED Requirements

### Requirement: Textbook search documents do not bypass section-level planning
Textbook search-document rows SHALL remain citation-support records unless a reviewed parent section owns the PlanningUnit role.

#### Scenario: Search-document row is reviewed
- **WHEN** a textbook search-document row is classified during resource governance
- **THEN** it SHALL be linked to a reviewed parent section, supporting citation target, embedded asset, or exclusion rationale
- **AND** it SHALL NOT become an independent PathNode solely because it is citation-ready.

#### Scenario: Parent section is not reviewed
- **WHEN** a search-document row belongs to an unreviewed or unsuitable parent section
- **THEN** the row SHALL remain limited supporting material or excluded with rationale
- **AND** the helper SHALL report the parent-section dependency separately from citation-anchor gaps.
