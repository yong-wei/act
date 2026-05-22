## ADDED Requirements

### Requirement: Teacher review resolves pre/post tracking generically
The teacher review system SHALL derive pre/post tracking from CourseEvidenceSpec rather than unit-specific page branches.

#### Scenario: Module 5 review produces delta
- **WHEN** a completed 5-3, 5-4, 5-5, or 5-6 session has matching student state or durable submissions
- **THEN** teacher review returns pre, post, delta, evidence quality, and recoverability

### Requirement: Legacy evidence remains limited
The teacher review system SHALL mark legacy evidence as limited when answers or scoring context cannot be recovered.

#### Scenario: Unrecoverable legacy state is not scored
- **WHEN** a legacy envelope lacks durable or final-state answers
- **THEN** teacher review reports limited recoverability and does not fabricate question summaries
