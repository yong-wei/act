## ADDED Requirements

### Requirement: Domain crossings use explicit public and application contracts
New domain code SHALL expose a stable `public-api` and SHALL place orchestration in application use cases with infrastructure-neutral ports and explicit adapters; cross-domain callers SHALL depend on those contracts rather than implementation paths.

#### Scenario: A new cross-domain caller is added
- **WHEN** a feature, route, worker, or domain needs another domain capability
- **THEN** it SHALL import the target domain public API or application use case
- **AND** the dependency graph SHALL record the owner and contract boundary.

#### Scenario: A domain contract is absent
- **WHEN** a proposed call has no public API, application use case, or declared port
- **THEN** the architecture fitness check SHALL fail
- **AND** it SHALL not approve a direct internal-file import as a substitute.

### Requirement: Forbidden dependency directions fail closed for new production code
The project SHALL reject production `feature -> app` imports, cross-domain deep imports, and domain-core imports of Prisma, Next, React, route modules, database clients, or equivalent delivery/infrastructure implementations.

#### Scenario: A feature imports an App Router implementation
- **WHEN** a production file under `src/features` imports `src/app` or an App Router route module
- **THEN** the fitness check SHALL fail with the source, target, owner classification, and replacement boundary
- **AND** test-only route imports SHALL remain separately classified rather than masking the production result.

#### Scenario: Domain core imports infrastructure
- **WHEN** domain-core code imports Prisma, Next, React, a route handler, or a database client
- **THEN** the fitness check SHALL fail
- **AND** the implementation SHALL require a port or adapter boundary.

### Requirement: New business code in `src/lib` is frozen
The project SHALL reject new business-domain files under `src/lib` unless a chartered platform/infrastructure owner and an explicit exception with deletion condition are recorded.

#### Scenario: A new shared business helper is proposed
- **WHEN** a change adds a business rule, use case, DTO, repository, or domain state machine under `src/lib`
- **THEN** the architecture check SHALL fail or require a pre-declared charter exception
- **AND** the caller SHALL identify the owning domain module instead.

### Requirement: Existing violations use a closed, only-decreasing allowlist
The temporary dependency allowlist SHALL be derived from the complete baseline denominator, preserve production/test/generated/compatibility/framework classifications, and permit only removal or compliant replacement of existing entries.

#### Scenario: An existing violation is recorded
- **WHEN** a baseline edge is not yet migrated
- **THEN** the allowlist SHALL record stable edge identity, owner, consumers, reason, deletion condition, and follow-up change
- **AND** the edge SHALL remain visible in the graph and SCC reports.

#### Scenario: A new violating edge is introduced
- **WHEN** a later revision adds an edge not present in the baseline allowlist
- **THEN** qualification SHALL fail
- **AND** a broader pattern or new exception SHALL not be accepted as a workaround.

### Requirement: Architecture fitness checks reconcile dependency edges and SCCs
The project SHALL provide a local architecture fitness check that reconciles forward and reverse dependency edges, cross-domain deep imports, feature-to-App Router imports, and complete strongly connected components against their declared denominators.

#### Scenario: A new cross-domain cycle appears
- **WHEN** the filtered production graph contains a new bidirectional or longer cross-domain strongly connected component
- **THEN** the fitness check SHALL fail with every member and edge identity
- **AND** it SHALL identify the owner and deletion condition for any pre-existing component.

#### Scenario: Existing debt is checked without migration
- **WHEN** the unchanged baseline is evaluated
- **THEN** the check SHALL report existing allowlisted violations without claiming that legacy code has been migrated
- **AND** it SHALL fail only for new or unaccounted violations under the declared staging policy.

### Requirement: Existing safety and rendering contracts remain authoritative
Dependency enforcement SHALL preserve the requirements of `frontend-build-source-boundary`, `owned-surface-module-hygiene`, `server-action-and-route-safety`, `app-router-rendering-boundary-safety`, and `stable-dependency-chain-migration` without duplicating, weakening, or silently replacing them.

#### Scenario: A dependency rule touches a governed route
- **WHEN** a route or Server Action is moved behind a domain contract
- **THEN** authentication, authorization, GET side-effect, server-state, rendering-boundary, and verification requirements SHALL remain unchanged
- **AND** the fitness check SHALL not be used to justify behavior changes.

### Requirement: Dependency contract enforcement does not claim full migration
This change SHALL establish rules and evidence only; it SHALL not claim that all historical violations, legacy `src/lib` files, facades, or domains have been migrated, deleted, or activated in production.

#### Scenario: Contract enforcement completes
- **WHEN** the architecture fitness suite passes under the staged allowlist
- **THEN** the result SHALL identify the remaining allowlisted debt and next deletion conditions
- **AND** it SHALL not claim deployment, production activation, or repository-wide refactor completion.
