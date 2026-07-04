## ADDED Requirements

### Requirement: Student Personal Center is a single first-level destination
The platform SHALL present Personal Center as the single student-facing account and learner-record destination.

#### Scenario: Student opens personal center navigation
- **WHEN** a student uses homepage, AppShell rail, account menu, or role entry navigation to open learner record or account context
- **THEN** the UI SHALL route to `/profile` as the canonical Personal Center destination labeled 个人中心
- **AND** it SHALL NOT present `/dashboard` and `/profile` as two equivalent first-level destinations.

#### Scenario: Existing dashboard links are used
- **WHEN** an existing link, callback, or role-cockpit contract opens `/dashboard`
- **THEN** the platform SHALL preserve compatibility by redirecting, wrapping, or otherwise resolving to the `/profile` Personal Center experience
- **AND** authorization and role redirects SHALL remain intact.

#### Scenario: Profile subroutes remain reachable
- **WHEN** a student needs growth, portfolio, or evidence details
- **THEN** `/profile/growth`, `/profile/portfolio`, and `/profile/evidence` SHALL remain reachable as secondary Personal Center views or report-ledger routes.
