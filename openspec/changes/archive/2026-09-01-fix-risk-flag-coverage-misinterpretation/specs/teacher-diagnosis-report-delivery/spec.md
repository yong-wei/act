# teacher-diagnosis-report-delivery Delta

## ADDED Requirements

### Requirement: Evidence-conflict downgrades surface a structured confidence reason

When a persisted report's confidence is below `high` because of a declared cross-source evidence conflict while student, assignment, assessment, and learning-behavior coverage are complete, the teacher report history projection SHALL produce a structured confidence reason describing the evidence conflict, and the availability state, reason, and recovery action SHALL point to the conflict and teacher re-review rather than to data coverage. The generic "no verifiable confidence reason / supplement verifiable evidence" fallback SHALL be used only when no structured reason of any known kind applies, and SHALL NOT appear when coverage is complete and a declared limitation or conflict explains the downgrade.

#### Scenario: Complete coverage with a declared evidence conflict

- **WHEN** a report has `sourceCoverage.coverage = 1`, zero missing assignment and assessment students, and a declared cross-source conflict limitation with confidence `medium`
- **THEN** the history projection SHALL describe the downgrade as an evidence conflict with a teacher re-review recovery action
- **AND** SHALL NOT show a coverage-gap recovery suggestion or the generic supplement-evidence fallback.

#### Scenario: Generic fallback only as last resort

- **WHEN** a report's confidence is below `high` and no coverage gap, attribution limitation, declared limitation, or evidence conflict explains it
- **THEN** the projection MAY use the generic fallback reason
- **AND** genuine coverage gaps, attribution limitations, and behavior-source absences SHALL keep their existing accurate states.
