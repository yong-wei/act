## Purpose

Define the retirement contract for the legacy LSUM special course so it no longer appears as an active interactive course route, catalog item, preset, or session context.
## Requirements
### Requirement: Legacy LSUM course route is retired
The system SHALL remove the legacy `lsum-design-feasible-domain` course from the interactive learning route surface.

#### Scenario: LSUM route tree is absent
- **WHEN** the course App Router tree is inspected
- **THEN** `/interactive-learning/courses/lsum-design-feasible-domain` SHALL NOT exist
- **AND** no student or teacher child route SHALL remain for that segment.

#### Scenario: LSUM is absent from public course catalogs
- **WHEN** the interactive learning catalog and derived lesson groups are built
- **THEN** no lesson entry SHALL expose id, href, or route segment `lsum-design-feasible-domain`.

### Requirement: Retired LSUM course cannot seed sessions
The system SHALL remove active LSUM session seeding and course-context registration.

#### Scenario: Presets and contexts do not include LSUM
- **WHEN** teacher presets, AI contexts, and session snapshot route aliases are inspected
- **THEN** they SHALL NOT register `lsum-design-feasible-domain` or `lsum-design-feasible-domain-v1`
- **AND** tests SHALL assert this absence instead of preserving a hidden compatibility path.
