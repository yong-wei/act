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
