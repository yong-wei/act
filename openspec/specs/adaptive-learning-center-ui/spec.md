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

### Requirement: Learner data surfaces share one product shell
The adaptive learning center SHALL provide a shared learner data shell for dashboard, profile, growth center, evidence, adaptive practice, and recommended path surfaces.

#### Scenario: Student opens a learner data route
- **WHEN** `/dashboard`, `/profile`, `/profile/growth`, `/profile/evidence`, `/assessment/adaptive-practice`, or a recommended path surface renders
- **THEN** the surface SHALL use consistent ability dimensions, evidence status, current path, recommendation, and next-action semantics
- **AND** it SHALL preserve route identity without presenting each page as a separate product.

### Requirement: Recommended paths render as staged learning routes
The adaptive learning center SHALL render recommendations as staged route nodes where path data is available.

#### Scenario: Recommended path exists
- **WHEN** a student has an active or recommended learning path
- **THEN** the UI SHALL show stage, node, priority, confidence or evidence limitation, expected effort, source context, and launch action
- **AND** it SHALL distinguish current node, completed nodes, blocked nodes, and optional alternatives.

### Requirement: Learner data empty states are actionable
The adaptive learning center SHALL render empty, stale, low-confidence, and no-data states as complete learner-facing states.

#### Scenario: Learner data is incomplete
- **WHEN** ability profile, evidence, path, recommendation, or practice data is missing or low confidence
- **THEN** the surface SHALL explain the limitation and provide adjacent actions such as start practice, review evidence, open Interactive Learning, or enter a simulation/Arena task where available.

### Requirement: Adaptive center specializes the control-correction learning path
The adaptive learning center SHALL provide a complete student-facing surface for the `control-correction` goal.

#### Scenario: Student opens the control-correction center
- **WHEN** a student opens the adaptive learning center with `goal=control-correction`
- **THEN** the page SHALL show the learner's control-correction competency state, current path status, next action, readiness gate, evidence timeline, citation access, and Konling support according to available feature flags
- **AND** each personalized claim SHALL expose confidence or evidence-limit metadata when applicable.

#### Scenario: Student enters from an existing adaptive route
- **WHEN** a student enters from homepage, cockpit, profile, adaptive practice, or a contextual recommendation
- **THEN** the center SHALL preserve the route intent for practice, learner-state review, path execution, or evidence review
- **AND** it SHALL not lose the original task intent during migration.

#### Scenario: Control-correction data is incomplete
- **WHEN** learner state, path, questions, citations, or evidence are unavailable, stale, low-confidence, or feature-flagged off
- **THEN** the surface SHALL render a branded actionable fallback with recovery or adjacent actions
- **AND** it SHALL NOT show a blank task area.

### Requirement: Control-correction center supports path execution launches
The adaptive learning center SHALL launch control-correction ResourceNodes while preserving path context.

#### Scenario: Student launches a node
- **WHEN** the student opens a knowledge, exercise, simulation, Arena, reflection, or AI-intervention node from the path map or next-action card
- **THEN** the launch target SHALL carry the owning path id, node id, goal id, and route intent where supported
- **AND** returning to the center SHALL restore the same path context unless the path was recalculated.

### Requirement: Learner center prioritizes current path and next action
The adaptive learning center SHALL present learner record and pathway state as a guided next-action surface.

#### Scenario: Student opens learner center or adaptive practice
- **WHEN** dashboard, profile, growth, evidence, or adaptive practice entry renders
- **THEN** current path, next recommended action, confidence, and missing-evidence state SHALL be visible before secondary metrics
- **AND** repeated metric cards SHALL NOT be the only hierarchy.

### Requirement: Learner record shows evidence write-back from core learning work
The adaptive learning center SHALL show how core learning work contributes to learner record and next recommendations.

#### Scenario: Evidence from learning work is available
- **WHEN** interactive lesson submission, Arena official/preview result, simulation/Workbench completion, or adaptive practice submission is available
- **THEN** learner record surfaces SHALL present freshness, confidence, source scope, missing-source state, and next action
- **AND** unavailable evidence instrumentation SHALL be shown honestly rather than fabricated as complete progress.

### Requirement: Low evidence states are actionable
The adaptive learning center SHALL turn low confidence and missing source coverage into actionable states.

#### Scenario: Evidence is incomplete
- **WHEN** learner evidence is stale, partial, missing, or low confidence
- **THEN** the UI SHALL explain what is missing and where the learner or teacher can continue
- **AND** it SHALL NOT present fabricated precision.
