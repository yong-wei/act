# shared-react-state-effect-safety Specification

## Purpose
Define the React state and effect safety contract for shared components, hooks, and active platform surfaces so selection, local editing, asynchronous previews, and status feedback avoid stale prop-synced state, clean up resources, and remain locally verifiable with React Doctor.

## Requirements
### Requirement: Shared and active platform components avoid stale prop-synced state
The system SHALL avoid effect-driven prop-to-state synchronization in shared components and active platform surfaces when state can be derived, keyed, or adjusted without a stale intermediate render.

#### Scenario: Active component receives a new selected entity
- **WHEN** an Arena, Control Workbench, Knowledge, Admin, or shared component receives a new selected entity or identity prop
- **THEN** the component SHALL reset or derive dependent state without displaying stale state for the previous identity

#### Scenario: User-edited state remains valid
- **WHEN** the parent re-renders without changing the owning identity of user-edited local state
- **THEN** the component SHALL preserve the user-edited state

### Requirement: Shared and active platform effects clean up resources
The system SHALL clean up timers, subscriptions, listeners, animation frames, and similar resources created by shared or active platform effects.

#### Scenario: Component unmounts during pending async UI feedback
- **WHEN** a shared or active platform component unmounts while a timer, listener, or subscription is active
- **THEN** the component SHALL dispose that resource and SHALL NOT update unmounted state

### Requirement: Shared and active platform effect dependencies are stable
The system SHALL use stable immutable values or primitive signatures for effect dependencies in shared and active platform files.

#### Scenario: Effect depends on collection inputs
- **WHEN** an effect depends on selected ids, panels, nodes, options, or preview entries
- **THEN** the dependency SHALL change only when the logical collection changes

### Requirement: Shared state/effect React Doctor validation is local and version-pinned
The system SHALL validate this change with React Doctor `0.5.1` in local error-only mode.

#### Scenario: Developer validates shared state/effect cleanup
- **WHEN** a developer runs `npx --yes react-doctor@0.5.1 --no-score --no-telemetry --no-warnings --json .`
- **THEN** the report SHALL contain no state/effect diagnostics for files covered by this change
