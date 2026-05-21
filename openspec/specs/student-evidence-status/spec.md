# student-evidence-status Specification

## Purpose
Define the learner-facing evidence status surface used by student profiles and recommendation cards so missing, stale, or low-confidence governed evidence is visible instead of being presented as precise diagnosis.

## Requirements
### Requirement: Student profile exposes evidence status
The student profile API SHALL include governed evidence status from feature cache and facts.

#### Scenario: Missing cache is explicit
- **WHEN** a student has no feature cache entry
- **THEN** the profile response marks evidence status missing and avoids precise high-confidence explanations

### Requirement: Recommendation rationale keeps evidence metadata
Student-facing recommendation outputs SHALL preserve evidence basis, window, count, source coverage, and confidence metadata.

#### Scenario: Low-confidence recommendation is labeled
- **WHEN** a recommendation is produced from stale or partial evidence
- **THEN** the response exposes low-confidence metadata for the UI
