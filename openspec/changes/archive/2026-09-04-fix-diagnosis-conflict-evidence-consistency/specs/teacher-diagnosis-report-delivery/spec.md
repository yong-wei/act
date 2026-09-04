## MODIFIED Requirements

### Requirement: Evidence-conflict downgrades surface a structured confidence reason

When a persisted report's confidence is below `high` because of a verified cross-source evidence conflict while student, assignment, assessment, and learning-behavior coverage are complete, the teacher report history projection SHALL produce a structured confidence reason describing the evidence conflict, and the availability state, reason, and recovery action SHALL point to the conflict and teacher re-review rather than to data coverage. The projection SHALL NOT treat natural-language conflict wording alone as a verified conflict. Unverifiable historical conflict claims SHALL be presented as needing regeneration or manual review, not as「证据存在冲突」. The generic "no verifiable confidence reason / supplement verifiable evidence" fallback SHALL be used only when no structured reason of any known kind applies, and SHALL NOT appear when coverage is complete and a declared limitation or verified conflict explains the downgrade.

#### Scenario: Complete coverage with a declared evidence conflict

- **WHEN** a report has `sourceCoverage.coverage = 1`, zero missing assignment and assessment students, a declared cross-source conflict limitation with confidence `medium`, and verified same-student close-window opposite-direction cited evidence
- **THEN** the history projection SHALL describe the downgrade as an evidence conflict with a teacher re-review recovery action
- **AND** SHALL NOT show a coverage-gap recovery suggestion or the generic supplement-evidence fallback.

#### Scenario: Unverifiable historical conflict wording

- **WHEN** a complete-coverage medium-confidence report contains conflict wording but the cited evidence is missing, cross-student, equal-score, wrong-direction, or otherwise unverifiable
- **THEN** the history projection SHALL present the report as needing regeneration or manual review
- **AND** it SHALL NOT label the availability state as「证据存在冲突」.

#### Scenario: Generic fallback only as last resort

- **WHEN** a report's confidence is below `high` and no coverage gap, attribution limitation, declared limitation, or evidence conflict explains it
- **THEN** the projection MAY use the generic fallback reason
- **AND** genuine coverage gaps, attribution limitations, and behavior-source absences SHALL keep their existing accurate states.
