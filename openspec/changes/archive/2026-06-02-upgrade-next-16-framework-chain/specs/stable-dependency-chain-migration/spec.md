## ADDED Requirements

### Requirement: Next framework upgrades preserve application and deployment behavior
The project SHALL validate application routes, lint behavior, build output, and deployment assumptions when upgrading the Next framework chain.

#### Scenario: Next 16 upgrade is reviewed
- **WHEN** Next is upgraded to the selected latest stable Next 16 release
- **THEN** typecheck, lint, default tests, unit tests, build, audit reporting, and browser route checks SHALL pass or document explicit blockers
- **AND** standalone build and Docker deployment assumptions SHALL be verified or assigned to a blocking follow-up.

### Requirement: Next upgrades do not absorb unrelated major lanes
The project SHALL keep unrelated major migrations outside the Next framework change.

#### Scenario: Next framework change is scoped
- **WHEN** Next and directly related framework tooling are updated
- **THEN** React 19, Prisma 7, Tailwind 4, and 3D visualization major upgrades SHALL remain out of scope unless required by verified peer constraints.
