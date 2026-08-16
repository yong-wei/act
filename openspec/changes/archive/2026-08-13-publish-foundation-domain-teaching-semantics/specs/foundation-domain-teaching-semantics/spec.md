## ADDED Requirements

### Requirement: Foundation domains publish reviewed direct teaching semantics
The system SHALL publish reviewed core-node memberships and direct REQUIRED or RECOMMENDED ACT_TEACHING prerequisite relations for system modeling, time-domain analysis and stability analysis. Every published relation SHALL have a direct pedagogical rationale or ACT evidence reference.

#### Scenario: Foundation relation is accepted
- **WHEN** reviewers confirm a direct dependency between current core nodes in the three foundation domains
- **THEN** the fragment SHALL preserve its direction, strength, scope and evidence
- **AND** it SHALL not persist transitive closure as another teaching fact

#### Scenario: Candidate remains unresolved
- **WHEN** a candidate lacks sufficient teaching evidence
- **THEN** it SHALL remain unpublished without blocking other valid foundation relations
- **AND** no engineering predicate SHALL substitute for the missing teaching decision
