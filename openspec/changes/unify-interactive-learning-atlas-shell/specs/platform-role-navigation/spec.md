## ADDED Requirements

### Requirement: Interactive learning atlas preserves route hierarchy
Interactive learning atlas routes SHALL expose platform breadcrumbs and return continuity for multi-level learning navigation.

#### Scenario: User opens a nested interactive learning page
- **WHEN** the user opens an interactive learning catalog, chapter component list, or cross-domain list route
- **THEN** the platform breadcrumb SHALL identify the route hierarchy from home to the current surface
- **AND** route-local controls SHALL NOT replace platform navigation or obscure the return path.

#### Scenario: User enters cross-domain exploration list
- **WHEN** the cross-domain exploration list is shown
- **THEN** the list shell SHALL preserve route continuity
- **AND** Control Odyssey and Ten Drops internals MAY keep their own interaction-specific layouts outside this change.
