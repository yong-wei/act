## ADDED Requirements

### Requirement: Resource components avoid stale prop-synced state
The system SHALL avoid effect-driven prop-to-state synchronization in resource, widget, and simulation components when state can be derived, keyed, or adjusted without a stale intermediate render.

#### Scenario: Resource identity changes
- **WHEN** a legacy resource, widget, or simulation preview receives a new resource identity, selected item, scenario, or model reference
- **THEN** dependent UI state SHALL reset or derive from the new identity without showing stale state

#### Scenario: Resource parent re-renders same identity
- **WHEN** a resource parent re-renders without changing the owning identity
- **THEN** local user interaction state SHALL remain stable

### Requirement: Simulation state/effect repairs preserve numerical semantics
The system SHALL preserve simulation and control numerical semantics when repairing React state/effect diagnostics in simulation UI files.

#### Scenario: Simulation UI state is refactored
- **WHEN** a simulation component changes UI state reset, effect cleanup, or dependency logic
- **THEN** the underlying control model, physics model, step timing semantics, and displayed metric meaning SHALL remain unchanged

### Requirement: Resource effects clean up resources
The system SHALL clean up timers, animation frames, listeners, subscriptions, and similar resources created by resource, widget, or simulation effects.

#### Scenario: Resource unmounts during animation or delayed UI feedback
- **WHEN** a resource, widget, or simulation component unmounts while a timer, animation frame, or listener is active
- **THEN** the resource SHALL dispose that callback or listener without updating unmounted state

### Requirement: Resource state/effect React Doctor validation is local and version-pinned
The system SHALL validate this change with React Doctor `0.5.1` in local error-only mode.

#### Scenario: Developer validates resource state/effect cleanup
- **WHEN** a developer runs `npx --yes react-doctor@0.5.1 --no-score --no-telemetry --no-warnings --json .`
- **THEN** the report SHALL contain no state/effect diagnostics for files covered by this change
