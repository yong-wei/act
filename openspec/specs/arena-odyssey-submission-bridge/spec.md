# arena-odyssey-submission-bridge Specification

## Purpose
TBD - created by archiving change arena-teaching-platform-integration. Update Purpose after archive.
## Requirements
### Requirement: Odyssey completion can create an Arena submission artifact
The system SHALL convert eligible Control Odyssey completion results into deterministic Arena-recognizable artifacts for official evaluation.

#### Scenario: Eligible Odyssey completion
- **WHEN** a logged-in student completes an eligible Odyssey level and tier
- **THEN** the system MUST be able to derive an Arena artifact from the run id, level id, controller configuration, tier, and measured metrics

#### Scenario: Duplicate Odyssey run
- **WHEN** the same Odyssey run id is submitted twice to the Arena bridge
- **THEN** the system MUST avoid creating duplicate Arena submissions for the same run and publication or task context

### Requirement: Odyssey game progression remains independent
The Arena bridge SHALL NOT replace existing Odyssey score, credit, unlock, or AI-history behavior.

#### Scenario: Arena bridge failure
- **WHEN** Odyssey game score persistence succeeds but Arena bridge submission fails
- **THEN** the existing Odyssey score and credit flow MUST remain intact and the Arena bridge failure MUST be reportable separately

### Requirement: Odyssey Arena score comes from official Arena evaluation
The system SHALL NOT treat the raw Odyssey game score as the Arena official score.

#### Scenario: Odyssey score submission
- **WHEN** an Odyssey completion is bridged into Arena
- **THEN** the Arena score MUST come from `/api/arena/evaluate` or the same official evaluation service path, not from the game score field

