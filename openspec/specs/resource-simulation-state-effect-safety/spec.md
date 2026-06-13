# resource-simulation-state-effect-safety Specification

## Purpose
Define the state and effect safety contract for legacy resource decks, reusable widgets, simulations, and control-system UI so React state repairs preserve local interactions, dispose UI resources, and do not alter numerical model semantics.
## Requirements
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

### Requirement: Resource React Doctor error baseline is cleared
The system SHALL clear React Doctor error diagnostics under resource, widget, simulation, and control-system resource files without weakening React Doctor error rules.

#### Scenario: Developer validates resource error cleanup
- **WHEN** a developer runs the owned-surface React Doctor error gate
- **THEN** the report SHALL contain zero error diagnostics for `src/resources/interactive-learning/**`, `src/resources/simulations/**`, `src/resources/widgets/**`, and `src/resources/control-system/**`
- **AND** resource fixes SHALL NOT change declared course content, scoring, numerical model semantics, or metric definitions

### Requirement: Resource identity resets are explicit
Resource components SHALL reset local UI state only on explicit resource, model, scenario, slide, or activity identity changes.

#### Scenario: Resource parent rerenders same identity
- **WHEN** a parent rerenders a resource component without changing the owning identity
- **THEN** local user interaction state SHALL remain stable

#### Scenario: Resource identity changes
- **WHEN** the owning resource, model, scenario, slide, or activity identity changes
- **THEN** dependent UI state SHALL reset deliberately without showing stale state from the previous identity

### Requirement: Resource side effects dispose callbacks
Resource, widget, and simulation components SHALL dispose timers, animation frames, subscriptions, event listeners, and delayed callbacks created by effects.

#### Scenario: Simulation unmounts during delayed update
- **WHEN** a simulation or resource unmounts while a delayed callback is pending
- **THEN** the callback SHALL be canceled or guarded so it does not update unmounted or stale state
