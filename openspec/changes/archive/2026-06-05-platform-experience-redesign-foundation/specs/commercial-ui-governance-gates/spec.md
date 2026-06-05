## ADDED Requirements

### Requirement: Commercial UI acceptance requires archetype conformance
Commercial UI governance SHALL reject primary route migrations that cannot demonstrate conformance to the registered experience archetype.

#### Scenario: A redesigned page is reviewed
- **WHEN** a PR changes a primary UI route
- **THEN** review evidence SHALL name the route archetype, supported navigation layers, light/dark template behavior, mobile behavior, and first-viewport primary task
- **AND** the page SHALL fail acceptance if it only adds platform tokens, borders, screenshots, or `data-commercial-*` markers without matching the archetype.

### Requirement: Temporary exceptions are narrow and scheduled for removal
Commercial UI governance SHALL allow temporary exceptions only for legacy pages that cannot be migrated in the current change.

#### Scenario: A legacy shell remains
- **WHEN** a primary route keeps an incompatible legacy shell or local navigation pattern
- **THEN** the exception SHALL name the route, violated archetype rule, owning downstream issue, and removal condition
- **AND** the exception SHALL NOT cover newly introduced UI.

### Requirement: Experience acceptance rejects template-only composition
Commercial UI governance SHALL reject route migrations that use the new vocabulary without demonstrating route continuity, non-template composition, mobile behavior, and theme parity.

#### Scenario: A migrated route is accepted
- **WHEN** a primary route migration is reviewed
- **THEN** the evidence SHALL show non-template composition tied to the declared archetype, continuity from prior route or role entry to next action, desktop and 320px mobile behavior, and light/dark theme parity where theme switching is supported
- **AND** screenshots, `data-commercial-*` markers, token usage, borders, or repeated card sections SHALL NOT be sufficient acceptance evidence on their own.

### Requirement: Decorative entry pages fail role-journey acceptance
Commercial UI governance SHALL reject entry pages that do not connect to a role journey, current task, evidence state, or next action.

#### Scenario: A public or role entry page is reviewed
- **WHEN** homepage, login, dashboard, Interactive Learning entry, student cockpit, teacher entry, or admin entry is redesigned
- **THEN** the page SHALL identify its role journey, business object or learning object, relevant evidence or status state, next action, and downstream report or governance destination when applicable
- **AND** decorative hero sections, atmospheric imagery, isolated feature grids, or metrics without role action SHALL fail acceptance unless registered as a temporary migration exception.
