## ADDED Requirements

### Requirement: Annotated media responses preserve selected evidence
Responses collected from annotated media and embedded visual activities SHALL preserve selected visual evidence and activity context.

#### Scenario: Student selects image evidence
- **WHEN** a student selects annotations or hotspots in annotated media
- **THEN** the response payload SHALL include annotation ids, evidence roles, active reveal state, and any embedded activity answer
- **AND** scoring SHALL be able to distinguish correct evidence from plausible but wrong hotspots.

#### Scenario: Embedded activity submits from a visual surface
- **WHEN** a student submits an answer from inside a visual stage or annotated media surface
- **THEN** the response payload SHALL conform to the canonical activity response contract
- **AND** it SHALL include the visual module id and anchor id.
