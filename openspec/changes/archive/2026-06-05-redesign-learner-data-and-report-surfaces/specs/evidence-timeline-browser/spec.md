## ADDED Requirements

### Requirement: Evidence timeline follows learner record hierarchy
The evidence timeline SHALL align with learner record and pathway hierarchy.

#### Scenario: Evidence browser renders
- **WHEN** a learner or authorized reviewer opens evidence history
- **THEN** timeline grouping, source freshness, confidence, privacy scope, and replay state SHALL use shared evidence/status roles
- **AND** mobile timeline filters SHALL not obscure the evidence list.

### Requirement: Evidence timeline preserves source-specific privacy
The evidence timeline SHALL preserve role-specific visibility for learner, teacher, and administrator review.

#### Scenario: Reviewer role changes
- **WHEN** the same learner evidence is viewed by student, teacher, or administrator contexts
- **THEN** source labels, privacy scope, hidden restricted details, and available next actions SHALL match the viewer role
- **AND** teacher-scoped or governance-scoped data SHALL NOT leak into student-facing evidence details.
