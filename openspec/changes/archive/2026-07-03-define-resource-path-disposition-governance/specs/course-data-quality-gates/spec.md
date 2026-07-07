## ADDED Requirements

### Requirement: Data completeness helper audits resource disposition coverage
The data completeness helper SHALL report whether all discovered resources have a reviewed path-planning disposition before full resource coverage can be accepted.

#### Scenario: Full resource coverage audit runs
- **WHEN** the helper audits graph, resource, citation, path-planning, evidence-lineage, and learner-fixture readiness
- **THEN** it SHALL also report resources missing path-planning disposition, reviewed semantic fields, parent planning-unit links, or exclusion rationale
- **AND** it SHALL keep these findings separate from citation readiness and retrieval indexing.
