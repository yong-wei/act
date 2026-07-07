## ADDED Requirements

### Requirement: SAR and teacher evidence typecheck debt preserves data governance
SAR persistence and teacher evidence typecheck repair SHALL update fixtures to current evidence contracts without weakening privacy or authority boundaries.

#### Scenario: SAR teacher evidence cluster is repaired
- **WHEN** the SAR/teacher evidence cleanup runs
- **THEN** TypeScript errors in SAR persistence and teacher KAQ evidence trace tests SHALL be eliminated
- **AND** persisted record types, learner-state fixtures, citation address nullability, corpus families, and source types SHALL match current contracts.

#### Scenario: Governance boundaries remain intact
- **WHEN** this change repairs TypeScript fixtures
- **THEN** it SHALL NOT loosen retention, privacy scope, source authority, or official scoring/evidence boundaries.
