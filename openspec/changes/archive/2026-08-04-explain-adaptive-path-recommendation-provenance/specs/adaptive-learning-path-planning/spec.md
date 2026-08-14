## ADDED Requirements

### Requirement: Candidate paths preserve aggregate recommendation basis
The adaptive learning path planner SHALL persist a student-safe aggregate recommendation basis snapshot for each formally generated candidate path without changing candidate selection, ranking, or scoring.

#### Scenario: Evidence supports a candidate path recommendation
- **WHEN** a candidate path is generated from learner-state deficits and governed resource nodes
- **THEN** the candidate path SHALL preserve one or more entries that connect an aggregate state summary to a capability or knowledge judgment and the path resources affected by that judgment
- **AND** each entry SHALL use generation-time facts so restoring the saved path does not reinterpret the original recommendation from newer learner state.
- **AND** the snapshot SHALL NOT represent aggregate counts or confidence as event-level evidence provenance.

#### Scenario: Evidence is insufficient for reliable personalization
- **WHEN** the candidate path or a target deficit has insufficient effective evidence
- **THEN** the provenance snapshot SHALL mark the explanation as low confidence and identify course structure, prerequisite policy, and available resources as the fallback basis
- **AND** it SHALL provide a student-safe evidence-gathering action rather than presenting missing evidence as a confirmed weakness.

#### Scenario: Student-safe provenance is produced
- **WHEN** aggregate recommendation basis is serialized for a student-facing candidate path
- **THEN** it SHALL contain only governed display labels, bounded evidence summaries, confidence, affected resource titles or identities, limitations, and a governed evidence-review target
- **AND** it SHALL NOT expose raw answers, private conversations, database identifiers, internal reason codes, raw evidence payloads, or hidden prompt content.
