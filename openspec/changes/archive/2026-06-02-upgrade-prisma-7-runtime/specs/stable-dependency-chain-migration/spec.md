## ADDED Requirements

### Requirement: Prisma runtime upgrades preserve database and deployment behavior
The project SHALL validate Prisma client generation, database scripts, worker access, and production migration commands when upgrading Prisma.

#### Scenario: Prisma 7 upgrade is reviewed
- **WHEN** Prisma CLI and client packages are upgraded to the selected latest stable Prisma 7 line
- **THEN** Prisma configuration, environment loading, client generation, migration deployment, and database-backed validation SHALL pass or document explicit blockers
- **AND** unrelated frontend framework and design-system upgrades SHALL remain out of scope.
