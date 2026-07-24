## ADDED Requirements

### Requirement: Compatible security refreshes preserve every touched dependency contract
The project SHALL allow one remediation batch to update multiple dependencies on their existing major lines only when every touched runtime or tooling contract is identified, verified independently, and preserved.

#### Scenario: Current-major security updates are grouped
- **WHEN** several package updates address one frozen audit snapshot without changing public APIs, data models, or package major lines
- **THEN** the change SHALL identify the owner and verification commands for each dependency lane
- **AND** each lane SHALL be applied and verified serially before the combined lockfile is accepted.

#### Scenario: Framework or authentication dependency is updated
- **WHEN** a compatible security update affects Next.js or NextAuth
- **THEN** the change SHALL verify the production build and representative route behavior
- **AND** credentials login, JWT encoding and decoding, custom session fields, server session retrieval, and protected-route authorization SHALL remain compatible.

#### Scenario: Prisma tooling dependency is updated
- **WHEN** a compatible security update affects Prisma CLI, Prisma Client, or a transitive Prisma tooling package
- **THEN** Prisma configuration loading, schema validation, client generation, database-backed scripts, worker access, and the documented migration-deploy command SHALL be verified in the final Linux/amd64 image against a disposable database
- **AND** shared or production databases SHALL be limited to read-only status checks during implementation
- **AND** no Prisma schema or data migration SHALL be created unless separately proposed.

#### Scenario: Image-processing dependency is updated
- **WHEN** a compatible security update affects Sharp or another production image-processing dependency
- **THEN** representative image and document rendering paths plus production build packaging SHALL be verified in the final Linux/amd64 image
- **AND** an audit-only resolution SHALL NOT be accepted if those runtime paths regress.

#### Scenario: Final production image is verified
- **WHEN** the compatible security refresh is ready for release
- **THEN** `scripts/build.sh` SHALL produce the immutable image used for acceptance
- **AND** the app, data-governance worker, scheduler, Prisma deploy/status, image/document processing, and representative browser routes SHALL be verified from that same image with disposable PostgreSQL and Redis services.

#### Scenario: Candidate update requires a broader migration
- **WHEN** resolving a finding requires a package major transition, public contract change, database migration, or unrelated architectural work
- **THEN** that dependency lane SHALL be removed from the compatible remediation batch
- **AND** it SHALL be tracked as a separate change instead of expanding the current scope.
