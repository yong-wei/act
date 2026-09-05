## MODIFIED Requirements

### Requirement: Published prerequisites are ACT_TEACHING direct edges
Every published teaching prerequisite MUST use `layer: ACT_TEACHING`, `relationType: PREREQUISITE`, strength `REQUIRED` or `RECOMMENDED`, a declared scope, and provenance. Direct edges are stored; closure/order are deterministic derived views. An Engineering relation whose presentation family is `post-requisite` MUST be adopted as a REQUIRED teaching prerequisite with engineering provenance. Other engineering families (`association`, `derived_from`, `has_component`, and similar) MUST NOT publish as teaching prerequisites without separate ACT teaching evidence or curator rationale.

#### Scenario: Required edge has evidence
- **WHEN** two current core nodes have an authored evidence-backed dependency
- **THEN** the builder SHALL publish one direct `REQUIRED` edge with curator/source provenance

#### Scenario: Engineering post-requisite is the candidate
- **WHEN** an ActKG relation in the `post-requisite` presentation family connects two current Authority objects
- **THEN** the builder SHALL publish a matching `ACT_TEACHING` `PREREQUISITE` edge with that engineering relation as provenance
- **AND** it SHALL NOT wait for a separate textbook sentence before adopting the knowledge-order skeleton

#### Scenario: Engineering relation is the only candidate
- **WHEN** an ActKG `association`, `derived_from`, `has_component`, or other non-post-requisite engineering relation has no ACT teaching evidence
- **THEN** it SHALL remain a candidate and MUST NOT publish as a teaching prerequisite
