## ADDED Requirements

### Requirement: Learner portrait updates are stable and incremental
The learner portrait update engine SHALL treat portrait data as long-term state
that is incrementally corrected by new governed evidence.

#### Scenario: No new evidence is available
- **WHEN** a learner has an existing portrait v2 state
- **AND** no new governed evidence affects a dimension
- **THEN** the dimension score SHALL be preserved
- **AND** confidence or freshness MAY change according to a documented aging policy.

#### Scenario: Sparse evidence affects one dimension
- **WHEN** new evidence affects only one portrait dimension
- **THEN** only that dimension SHALL receive a score update
- **AND** unrelated dimensions SHALL NOT be reset to zero.

#### Scenario: Negative evidence is processed
- **WHEN** governed evidence explicitly indicates failure, misconception, unsafe action, or low-quality work
- **THEN** affected dimensions MAY decrease through a bounded update
- **AND** the update SHALL include rationale and evidence lineage.

#### Scenario: Context-only evidence is processed
- **WHEN** a LearningFact or event is marked as context-only or has no profile contribution
- **THEN** it SHALL NOT overwrite any portrait score
- **AND** it MAY appear in evidence context or activity history.
