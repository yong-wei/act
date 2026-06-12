## ADDED Requirements

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
