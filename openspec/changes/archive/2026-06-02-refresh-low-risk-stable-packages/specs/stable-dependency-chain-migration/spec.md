## ADDED Requirements

### Requirement: Low-risk stable package updates are isolated from major migrations
The project SHALL refresh compatible stable packages separately from framework, database, design-system, and visualization major upgrades.

#### Scenario: Low-risk package refresh is reviewed
- **WHEN** compatible package updates are applied
- **THEN** the change SHALL identify every upgraded direct dependency and whether the update is patch, minor, or lockfile-only
- **AND** it SHALL NOT include Next, React, Prisma, Tailwind, React Three Fiber, Drei, Three, ESLint major, TypeScript major, Zod major, or bcrypt major migration work.

### Requirement: Low-risk refresh records remaining dependency drift
The project SHALL record dependency drift that remains after low-risk package updates.

#### Scenario: Low-risk refresh validation completes
- **WHEN** outdated and audit commands are rerun
- **THEN** the change SHALL record resolved packages, still-outdated packages, remaining audit findings, and the owner change for each deferred major lane.
