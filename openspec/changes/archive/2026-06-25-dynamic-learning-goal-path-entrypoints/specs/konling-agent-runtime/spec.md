## ADDED Requirements

### Requirement: Konling path-advisor entrypoints follow registered LearningGoals
Konling SHALL expose adaptive path-advisor entrypoints for every registered `path-ready` LearningGoal that the adaptive path center can display.

#### Scenario: Student opens a registered goal path center
- **WHEN** an authenticated student opens `/assessment/adaptive-practice?goal=<goal-id>` for any registered `path-ready` LearningGoal
- **THEN** Konling SHALL receive a server-owned `path-advisor` context for that LearningGoal
- **AND** the context SHALL include the LearningGoal id, title, goal-specific topic, learning objectives, class scope, page id, and mode context token.

#### Scenario: Goal-specific quick prompts are shown
- **WHEN** Konling path-advisor quick prompts are built for a registered LearningGoal
- **THEN** the prompts SHALL name the active LearningGoal and its student-facing purpose
- **AND** they SHALL NOT be hard-coded to control-correction or frequency-response copy unless that is the active LearningGoal.

#### Scenario: LearningGoal context is incomplete
- **WHEN** a registered LearningGoal lacks metadata needed for path-advisor title, topic, objectives, quick prompts, or graph grounding
- **THEN** catalog or Konling entrypoint contract tests SHALL fail before the change can pass
- **AND** Konling SHALL NOT present generic advice as if it were grounded in a specific LearningGoal.

#### Scenario: Unknown goal requests path advisor
- **WHEN** a client requests path-advisor context for an unknown LearningGoal id
- **THEN** Konling SHALL reject the request through the governed registered-goal error path
- **AND** it SHALL NOT mint a mode context token for the unknown goal.
