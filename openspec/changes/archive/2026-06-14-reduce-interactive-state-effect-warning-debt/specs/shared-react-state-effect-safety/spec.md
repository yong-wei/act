## ADDED Requirements

### Requirement: Shared warning-level effects avoid parent synchronization loops
Shared components touched by React Doctor warning remediation SHALL avoid effect-driven parent synchronization when the parent update can be tied to a user action or explicit identity change.

#### Scenario: Shared component derives status from props
- **WHEN** a shared component derives trigger, status, selection, or display values from props
- **THEN** the value SHALL be derived during render or reset by explicit identity
- **AND** it SHALL NOT copy derived values into local state through an effect unless preserving user edits requires it.
