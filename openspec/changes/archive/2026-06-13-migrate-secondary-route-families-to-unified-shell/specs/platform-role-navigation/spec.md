## ADDED Requirements

### Requirement: Route inventory covers first-hop descendants
The central route inventory SHALL cover first-hop destinations and route-family descendants that are reachable from migrated primary routes.

#### Scenario: Migrated route exposes a primary action
- **WHEN** a migrated route links to a destination as a primary action, card action, command action, launch action, or workspace return target
- **THEN** the destination SHALL be registered directly, matched by a route pattern, or covered by an explicit route-family entry
- **AND** the inventory SHALL identify shell frame, role scope, navigation layers, mobile behavior, dock behavior, visual QA profile, and owner.

### Requirement: Contextual breadcrumbs persist across route families
The platform SHALL preserve contextual breadcrumbs and return targets when users move from parent routes into first-hop or descendant pages.

#### Scenario: User opens a descendant learning page
- **WHEN** a user moves from `/interactive-learning/chapter-components` into a chapter category or from a category into a resource page
- **THEN** the destination SHALL show a route trace back to the Interactive Learning context and the immediate parent category where applicable
- **AND** the return target SHALL be route-derived rather than a page-local hardcoded homepage link.

#### Scenario: User opens a cross-domain resource page
- **WHEN** a user moves from `/interactive-learning/cross-domain-exploration` into `/interactive-learning/resources/[id]`
- **THEN** the destination SHALL show a route trace back to the Interactive Learning context and cross-domain exploration source
- **AND** the return target SHALL preserve the source route rather than falling back to a page-local Interactive Learning homepage link.

### Requirement: Route inventory accepts only governed next-action continuity
Route-family inventory SHALL accept migrated entry pages only when their first student action stays within a registered shell family or a bounded exception.

#### Scenario: Student follows first action from a migrated entry
- **WHEN** a student follows the first learning, practice, challenge, experiment, review, or launch action from a migrated route
- **THEN** the destination SHALL remain within the unified navigation family or declare a bounded exception
- **AND** the parent route SHALL NOT be accepted as migrated if the first action opens an untracked local shell.
