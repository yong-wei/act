## ADDED Requirements

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
