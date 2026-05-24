## Purpose

Define the retirement contract for deprecated one-page interactive lesson routes so the interactive learning surface exposes only canonical course routes.

## Requirements
### Requirement: Retired one-page lesson routes are not exposed
The system SHALL remove deprecated `/interactive-learning/lesson-*` one-page lesson routes from the interactive learning surface.

#### Scenario: Deprecated route is absent from App Router
- **WHEN** the route tree is inspected
- **THEN** no `src/app/interactive-learning/lesson-*` route directory SHALL remain
- **AND** no catalog or navigation entry SHALL link to `/interactive-learning/lesson-*`.

#### Scenario: Retired route is not kept through compatibility redirects
- **WHEN** a retired one-page lesson slug is searched in route code
- **THEN** the system SHALL NOT provide a compatibility redirect that preserves the retired `/interactive-learning/lesson-*` URL as a supported entry point.

### Requirement: Runtime-first course routes remain canonical
The system SHALL keep active interactive lessons addressable only through their canonical course route segments.

#### Scenario: Active unit course remains in catalog
- **WHEN** an active runtime-first unit course is listed in the interactive catalog
- **THEN** its href SHALL use `/interactive-learning/courses/<route-segment>`
- **AND** the course SHALL NOT also expose an old `/interactive-learning/lesson-*` href.
