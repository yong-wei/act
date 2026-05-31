## Purpose

Define the unified student-facing adaptive learning center and migration compatibility for existing adaptive, AI, and profile surfaces.
## Requirements
### Requirement: Adaptive learning center unifies student adaptive surfaces
The system SHALL define a unified adaptive learning center UI contract for learner state, mastery, path visualization, evidence explanation, adaptive practice, and Konling support.

#### Scenario: Adaptive center contract is consumed
- **WHEN** a student-facing adaptive surface consumes the adaptive learning center contract
- **THEN** the contract SHALL expose overview, learner-state, mastery, current path, map, timeline, evidence explanation, practice, and Konling views according to available feature flags.

### Requirement: Existing adaptive routes remain compatible
The system SHALL keep existing adaptive and AI surfaces operational during migration.

#### Scenario: Legacy adaptive route is opened
- **WHEN** `/ai`, `/ai/copilot`, `/assessment/adaptive-practice`, or profile adaptive cards are opened during migration
- **THEN** the route SHALL either render the compatible legacy surface or route into the adaptive center without losing the original task intent.

### Requirement: Adaptive claims expose confidence and evidence limits
The system SHALL represent source coverage, confidence, privacy scope, fallback reason, and stale or partial state for adaptive claims.

#### Scenario: Path personalization is low confidence
- **WHEN** a path, recommendation, mastery state, or Konling intervention is based on weak or incomplete evidence
- **THEN** the UI SHALL identify the limiting evidence or mapping gap.

### Requirement: Adaptive learning entry preserves route intent
The adaptive learning center SHALL preserve the intent of the route that opened it and render a complete commercial entry state for practice, learner state, path, and review.

#### Scenario: Student enters adaptive practice from homepage
- **WHEN** a student opens `/assessment/adaptive-practice` from homepage, cockpit, profile, or a contextual recommendation
- **THEN** the page SHALL preserve the practice intent
- **AND** it SHALL show available questions, a loading state, or an evidence-limited fallback instead of a blank task area.

### Requirement: Adaptive empty states are branded and actionable
Adaptive learning empty states SHALL be visually complete, student-facing, and actionable.

#### Scenario: No adaptive question can be rendered
- **WHEN** the adaptive question list is empty because of evidence coverage, network state, feature flags, or data readiness
- **THEN** the surface SHALL explain the state in student-facing language
- **AND** it SHALL provide recovery or adjacent actions such as retry, learner-state review, Interactive Learning, or profile evidence review.
