## ADDED Requirements

### Requirement: AppShell route coverage is governed by tests
The platform SHALL include automated governance that detects non-home routes without universal shell coverage.

#### Scenario: Route source coverage is checked
- **WHEN** the shell governance test scans `src/app/**/page.tsx`
- **THEN** every non-home application route SHALL be classified as direct AppShell-covered, covered through a registered AppShell-compatible wrapper, or explicitly exempt
- **AND** unclassified routes SHALL fail the test.

#### Scenario: Exception inventory is checked
- **WHEN** a route is exempt from the universal shell frame
- **THEN** the exception record SHALL include route pattern, category, owner, reason, violated shell rule, and removal condition
- **AND** ordinary product, lesson, classroom, AI, graph, path, simulation, profile, teacher, or administrator pages SHALL NOT be exempt without a temporary blocker.

### Requirement: AppShell visual and DOM consistency is verified
The platform SHALL verify visible shell consistency on representative routes.

#### Scenario: Representative route matrix is tested
- **WHEN** primary and deep route representatives are loaded in browser validation
- **THEN** the tests SHALL verify canonical left navigation order, breadcrumb presence, and the exact top-right action order of theme switch followed by role-aware Personal Center
- **AND** screenshots SHALL demonstrate the same shell style across 1440, 1280, 1024, 768, 390, and 320 viewport widths.

#### Scenario: Wrapper registry is checked
- **WHEN** a route is classified through an AppShell-compatible wrapper
- **THEN** the wrapper SHALL be present in the governed wrapper registry and have passing DOM contract tests
- **AND** the route SHALL NOT count as covered merely because the wrapper name imports `AppShell`.

#### Scenario: Role-aware account targets are checked
- **WHEN** teacher or administrator routes are validated
- **THEN** the Personal Center action target SHALL be asserted as role-safe
- **AND** it SHALL NOT point to the student learner profile unless an explicit teacher-safe or administrator-safe profile mode exists.

#### Scenario: New routes are added
- **WHEN** a new route is added under `src/app/**/page.tsx`
- **THEN** it SHALL fail governance until it uses the universal shell or adds an approved exception record
- **AND** adding a route-local topbar or static sidebar SHALL NOT satisfy the shell contract.
