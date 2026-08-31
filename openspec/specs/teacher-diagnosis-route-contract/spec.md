# teacher-diagnosis-route-contract Specification

## Purpose
TBD - created by archiving change decouple-teacher-diagnosis-route-contract. Update Purpose after archive.
## Requirements
### Requirement: Teacher diagnosis report-history DTOs have one domain owner
The report-history GET DTO and serialized payload SHALL be defined and exported by the teacher diagnosis domain public API, not by the App Router route module.

#### Scenario: A route or feature consumes the contract
- **WHEN** the report-history route or a production teacher feature needs the report DTO
- **THEN** it SHALL import the canonical teacher diagnosis public API
- **AND** `route.ts` SHALL not define or re-export that DTO.

#### Scenario: A private persistence field is projected
- **WHEN** a diagnosis read model contains `inputSummary` or other server-internal data
- **THEN** the application/public projection SHALL omit it
- **AND** the public contract SHALL expose only the existing safe report fields.

### Requirement: The report-history slice uses an application use case and explicit adapter
The teacher diagnosis report-history path SHALL use an application use case over a domain-safe port, with persistence and framework details isolated in adapters and route delivery code.

#### Scenario: The route reads report history
- **WHEN** an authenticated teacher requests class or student report history
- **THEN** the route adapter SHALL invoke the teacher diagnosis application use case
- **AND** Prisma, `NextResponse`, `Request`, and React types SHALL remain outside the public contract and domain core.

#### Scenario: Persistence implementation changes
- **WHEN** the application reads diagnosis reports
- **THEN** it SHALL depend on the declared reader port rather than a Prisma model or route implementation
- **AND** the adapter SHALL map persistence records into the port's domain-safe shape.

### Requirement: Existing authorization and response semantics remain unchanged
The migration SHALL preserve authentication, teacher-role authorization, class/member scope checks, limit validation, status codes, error bodies, report ordering, field visibility, and ISO date serialization of the existing report-history endpoint.

#### Scenario: Unauthenticated or non-teacher request arrives
- **WHEN** an unauthenticated or non-teacher caller requests report history
- **THEN** the route SHALL return the existing authentication or permission response before report access
- **AND** the application SHALL not trust a caller-supplied teacher identity.

#### Scenario: Scope or query validation fails
- **WHEN** the class/member scope is unauthorized or `limit` is missing/invalid under the existing rules
- **THEN** the route SHALL return the existing error code/body and status
- **AND** it SHALL not broaden scope or create a new error contract.

#### Scenario: Authorized report history succeeds
- **WHEN** an authorized teacher requests valid class or current-member report history
- **THEN** the response SHALL preserve newest-first ordering, scope fields, report body, risk summary, optional generation metadata, and ISO `evidenceCutoff`/`generatedAt`
- **AND** `inputSummary` and raw private evidence payloads SHALL remain absent.

### Requirement: All production callers migrate directly to the domain contract
The two production consumers of the route-owned DTO SHALL import the teacher diagnosis public API directly, and production `feature -> app` imports for this slice SHALL reach zero.

#### Scenario: Feature history renders a report
- **WHEN** `teacher-diagnosis-report-history.tsx` or `teacher-diagnosis-report-history-projection.ts` uses the report DTO
- **THEN** it SHALL import the public API module
- **AND** it SHALL not import `src/app` or the route module.

#### Scenario: Architecture fitness runs after migration
- **WHEN** the dependency fitness check evaluates the slice
- **THEN** it SHALL report no production feature-to-App Router edge for this contract
- **AND** test-only route imports SHALL remain explicitly classified and visible.

### Requirement: The old route-owned entry is deleted without a facade
The migration SHALL remove the route-owned DTO exports and any re-export, alias, or forwarding module created to preserve the old import path.

#### Scenario: Migration is complete
- **WHEN** all production callers and tests use the domain public API
- **THEN** the old route type exports and forwarding paths SHALL be absent
- **AND** the deprecation ledger and dependency allowlist SHALL record the verified deletion of the old edges.

#### Scenario: A compatibility facade is proposed
- **WHEN** an implementation attempts to retain the old route import through a facade or re-export
- **THEN** the change SHALL fail review and architecture validation
- **AND** it SHALL require direct caller migration instead.

### Requirement: The vertical slice is characterized and verified at affected boundaries
The migration SHALL include characterization, public contract, application, route integration, feature, and architecture fitness tests covering the preserved behavior and deleted dependency edge.

#### Scenario: Tests run on the migrated slice
- **WHEN** targeted verification executes
- **THEN** it SHALL cover authentication, authorization, invalid limit, scope errors, success serialization/privacy, application port mapping, feature rendering/projection, and no production feature-to-App import
- **AND** affected teacher-domain tests and typecheck SHALL pass before the slice is qualified.

### Requirement: The slice does not expand into unrelated activation work
This change SHALL not alter diagnosis evidence/generation semantics, database schema, public URLs, unrelated diagnosis routes, deployment, production selectors, claims, or production activation.

#### Scenario: Vertical migration is qualified
- **WHEN** the report-history contract migration and ledgers are validated
- **THEN** the result SHALL identify the remaining diagnosis routes and dependency debt as follow-up work
- **AND** it SHALL not claim repository-wide modularization or production activation.
