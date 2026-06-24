# interactive-course-state-effect-safety Specification

## Purpose
Define the state and effect safety contract for manifest-driven interactive course surfaces so step, module, activity, resource, and viewer-role boundaries reset deliberately while same-identity re-renders preserve learner and teacher work.
## Requirements
### Requirement: Interactive course state resets only on course identity changes
The system SHALL reset local interactive course state only when the owning course identity changes, such as step id, module id, activity id, resource id, or viewer role where applicable.

#### Scenario: Step changes
- **WHEN** a student or teacher navigates to a different course step
- **THEN** step-owned local state SHALL reset consistently without showing stale state from the previous step

#### Scenario: Parent re-renders same step
- **WHEN** the parent re-renders the same step, module, activity, and viewer role
- **THEN** user-entered answers, selected cards, media choices, and teacher view state SHALL remain stable

### Requirement: Manifest runtime state/effect fixes preserve module contracts
The system SHALL preserve manifest module contracts when removing React Doctor state/effect errors from interactive runtime components.

#### Scenario: Activity renderer is refactored
- **WHEN** an activity renderer changes state reset or derived-state logic
- **THEN** it SHALL continue to consume the same module payload contract and emit the same activity state semantics

### Requirement: Interactive course effects clean up resources
The system SHALL clean up timers, listeners, subscriptions, and asynchronous UI resources created by interactive course components.

#### Scenario: Student leaves an interactive page
- **WHEN** a student leaves an interactive course page with pending timers or listeners
- **THEN** those resources SHALL be cleaned up without updating unmounted components

### Requirement: Interactive state/effect React Doctor validation is local and version-pinned
The system SHALL validate this change with React Doctor `0.5.1` in local error-only mode.

#### Scenario: Developer validates interactive state/effect cleanup
- **WHEN** a developer runs `npx --yes react-doctor@0.5.1 --no-score --no-telemetry --no-warnings --json .`
- **THEN** the report SHALL contain no state/effect diagnostics for files covered by this change

### Requirement: Interactive React Doctor error baseline is cleared for owned course runtime files
The system SHALL clear React Doctor error diagnostics under `src/features/interactive/**` without weakening the React Doctor error rules.

#### Scenario: Developer validates interactive course error cleanup
- **WHEN** a developer runs the owned-surface React Doctor error gate
- **THEN** the report SHALL contain zero error diagnostics for `src/features/interactive/**`
- **AND** no interactive course file SHALL rely on effect-driven prop-to-state synchronization for identity resets that can be derived, keyed, or adjusted without stale intermediate render

### Requirement: Interactive draft state survives same-identity rerenders
Interactive activity repairs SHALL preserve learner and teacher local state when the owning step, activity, resource, and viewer identity have not changed.

#### Scenario: Saved response object identity changes without step change
- **WHEN** an interactive activity receives an equivalent saved response for the same step and activity
- **THEN** touched local draft answers SHALL NOT be overwritten by effect-driven synchronization

#### Scenario: Step identity changes
- **WHEN** a student or teacher navigates to a different step identity
- **THEN** step-owned draft, release, media, or panel state SHALL reset deliberately without showing stale state from the prior step

### Requirement: Interactive warning-level state synchronization is reduced safely
Interactive course remediation SHALL reduce warning-level state/effect diagnostics without weakening course identity semantics.

#### Scenario: Child component reports user progress to a parent
- **WHEN** progress, reveal, answer, or tracking state changes because of a user action
- **THEN** the child SHALL report the change from the user action or explicit state owner
- **AND** it SHALL NOT rely on a render-following effect that pushes derived live state to the parent.

#### Scenario: Progress and submission reporting is refactored
- **WHEN** warning remediation changes progress, completion, score, release, analytics, or submission evidence reporting
- **THEN** emitted payload shape, score meaning, completion state, and submission evidence semantics SHALL remain unchanged
- **AND** representative tests SHALL prove event emission count and timing do not introduce missing, duplicate, or stale reports.

#### Scenario: Component receives equivalent state for the same identity
- **WHEN** a component receives new object identities representing the same step, activity, resource, and viewer
- **THEN** touched local learner or teacher state SHALL remain stable.

### Requirement: Interactive warning remediation records scoped evidence
Interactive warning cleanup SHALL record exactly which warning rules and files were targeted.

#### Scenario: Developer validates a warning cleanup batch
- **WHEN** the owned-surface React Doctor warning summary is captured
- **THEN** the report SHALL show the targeted rule/file counts before and after the batch
- **AND** non-target warning families SHALL remain advisory.
