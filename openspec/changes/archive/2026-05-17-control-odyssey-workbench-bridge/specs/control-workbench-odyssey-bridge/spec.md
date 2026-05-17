## ADDED Requirements

### Requirement: Odyssey bridge preserves original game progression
The Odyssey bridge SHALL preserve existing Control Odyssey game progression, score, level, and tuning behavior.

#### Scenario: Student plays Odyssey from Arena
- **WHEN** a student opens an Odyssey Arena task
- **THEN** the Control Odyssey runtime SHALL remain playable
- **AND** the original Odyssey score or progression SHALL continue to update independently from Arena official score.

### Requirement: Odyssey bridge shows Arena challenge context
The Odyssey bridge SHALL show Arena task context and official submission status around the Odyssey experience.

#### Scenario: Arena-bound Odyssey task opens
- **WHEN** the route includes an Odyssey `arenaTask`
- **THEN** the page SHALL show the Arena task title, allowed method, metric profile, and return link in Chinese.

### Requirement: Odyssey official submission uses Arena path
Odyssey results SHALL enter Arena leaderboards only through official Arena submission.

#### Scenario: Student submits Odyssey result to Arena
- **WHEN** a completed Odyssey run has sufficient telemetry
- **THEN** the bridge SHALL build an Arena-compatible result or controller artifact
- **AND** it SHALL submit through `/api/arena/evaluate` or an Arena adapter with the same persistence and hard-constraint behavior.

### Requirement: Odyssey bridge rejects incomplete telemetry
The Odyssey bridge SHALL NOT submit incomplete game state as an official Arena result.

#### Scenario: Student submits before run completion
- **WHEN** the current Odyssey run lacks required telemetry for official metrics
- **THEN** the bridge SHALL block official submission
- **AND** it SHALL show a Chinese explanation of the missing completion condition.
