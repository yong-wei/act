## ADDED Requirements

### Requirement: Adaptive learning center unifies student adaptive surfaces
The system SHALL provide a unified adaptive learning center for learner state, mastery, path visualization, evidence explanation, adaptive practice, and Konling support.

#### Scenario: Student opens adaptive center
- **WHEN** a student opens the adaptive learning center
- **THEN** the UI SHALL expose overview, learner-state, mastery, current path, map, timeline, evidence explanation, practice, and Konling views according to available feature flags.

### Requirement: Existing adaptive routes remain compatible
The system SHALL keep existing adaptive and AI surfaces operational during migration.

#### Scenario: Legacy adaptive route is opened
- **WHEN** `/ai`, `/ai/copilot`, `/assessment/adaptive-practice`, or profile adaptive cards are opened during migration
- **THEN** the route SHALL either render the compatible legacy surface or route into the adaptive center without losing the original task intent.

### Requirement: Adaptive claims expose confidence and evidence limits
The system SHALL display source coverage, confidence, privacy scope, fallback reason, and stale or partial state for adaptive claims.

#### Scenario: Path personalization is low confidence
- **WHEN** a path, recommendation, mastery state, or Konling intervention is based on weak or incomplete evidence
- **THEN** the UI SHALL identify the limiting evidence or mapping gap.
