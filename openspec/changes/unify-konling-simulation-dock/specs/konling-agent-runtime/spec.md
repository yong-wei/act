## ADDED Requirements

### Requirement: Konling receives simulation page context from server-owned sources
Konling SHALL load simulation page context from server-owned route, run, task, learner, and permission sources.

#### Scenario: Konling opens on simulation detail page
- **WHEN** Konling starts on a `/simulations/*` route
- **THEN** it SHALL resolve simulation id, route provenance, available run summary, task context, learner scope, and permitted tools from server-owned context
- **AND** client-provided page hints SHALL NOT expand user, class, resource, path, simulation, or privacy scope.

### Requirement: Simulation assistant fallback is explicit
Konling SHALL expose degraded or unavailable state when simulation context required for coaching is missing.

#### Scenario: Simulation context is incomplete
- **WHEN** Konling lacks required simulation run, task, or learner context
- **THEN** it SHALL present a degraded or unavailable state with a clear reason
- **AND** it SHALL NOT claim authoritative diagnosis from generic chat context alone.
