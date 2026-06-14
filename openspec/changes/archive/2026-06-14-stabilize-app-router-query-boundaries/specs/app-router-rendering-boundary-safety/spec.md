## ADDED Requirements

### Requirement: App Router query boundaries are explicit
App Router pages SHALL make query parameter ownership explicit when rendering client components.

#### Scenario: Server route renders a client student runtime
- **WHEN** a server route receives query parameters needed by a client student or runtime component
- **THEN** the server route SHALL pass stable primitive query values as props or render the client query reader behind an explicit Suspense boundary
- **AND** demo navigation semantics SHALL remain unchanged.

### Requirement: Route-owned data loads on the server where feasible
Route entry pages SHALL not fetch server-owned initial route data in client effects when that data can be loaded by the App Router server page.

#### Scenario: Learning entry page needs catalog or resource data
- **WHEN** the initial page render depends on route-owned catalog, category, resource, or assessment data
- **THEN** the data SHALL be loaded server-side or documented as a client-only exception with a loading-state reason.

### Requirement: Route metadata is present for owned pages
Owned App Router pages SHALL expose metadata directly or through a route-family helper.

#### Scenario: Owned page is part of a migrated product route family
- **WHEN** the page is included in React Doctor metadata remediation scope
- **THEN** it SHALL provide route metadata or be covered by an explicit route-family metadata helper.
