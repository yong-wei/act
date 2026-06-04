## ADDED Requirements

### Requirement: Personalization can cite governed path execution features
Profile, recommendation, and learner-state personalization SHALL be able to use governed control-correction path features as rationale without scanning raw execution payloads.

#### Scenario: Recommendation uses path evidence
- **WHEN** a recommendation references path completion, deviation, fallback, terminal validation, or intervention outcome
- **THEN** it SHALL identify the supporting governed feature group, evidence window, source count, confidence, and privacy-safe source references
- **AND** it SHALL NOT present unreviewed model-authored intervention text as a high-confidence competency fact.

#### Scenario: Path evidence is weak
- **WHEN** path evidence is missing, stale, partial, preview-only, or low-confidence
- **THEN** personalization output SHALL expose the limiting evidence state
- **AND** it SHALL NOT present the recommendation as a complete precise diagnosis.
