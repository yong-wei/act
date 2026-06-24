## MODIFIED Requirements

### Requirement: Arena pages provide a consistent student navigation shell
The system SHALL render the Arena hall and challenge detail pages with a consistent student-facing workspace shell that includes a theme-aware collapsible left project-entry navigation, a top breadcrumb derived from the real route path, mobile drawer navigation, and a right-side personal-center entry matching the homepage account semantics.

#### Scenario: Hall breadcrumb and project entries render
- **WHEN** a student opens `/arena`
- **THEN** the page SHALL show the breadcrumb labels `首页` and `竞技场首页`
- **AND** the left navigation SHALL include the homepage project entries required by the current student navigation contract
- **AND** the right side SHALL expose the same personal-center entry pattern used on the homepage
- **AND** the left navigation SHALL NOT include a review entry
- **AND** the shell SHALL support desktop expanded, desktop collapsed, and mobile drawer navigation states.

#### Scenario: Detail breadcrumb renders challenge name
- **WHEN** a student opens `/arena/challenges/task-second-order-lead-pid`
- **THEN** the page SHALL show the breadcrumb labels `首页`, `竞技场首页`, and the concrete challenge name
- **AND** the breadcrumb SHALL preserve navigation back to `/` and `/arena`
- **AND** the right side SHALL continue to expose the personal-center entry
- **AND** the shell SHALL preserve challenge context while switching between expanded, collapsed, and mobile navigation states.

## ADDED Requirements

### Requirement: Arena shell removes visible commercial vocabulary
Arena student-facing pages SHALL preserve the premium platform design intent without rendering visible `商业` wording in navigation, headings, badges, helper text, or data markers intended for users.

#### Scenario: Arena hall renders user-facing text
- **WHEN** a student opens `/arena`
- **THEN** no visible student-facing heading, badge, navigation item, action, or helper text SHALL contain `商业`
- **AND** the page SHALL still identify the current context as Arena, challenge discovery, training map, or related learning work.

### Requirement: Arena uses centralized visual-world assets
Arena student-facing shell and entry surfaces SHALL use centralized Arena visual-world assets only where they improve domain recognition, empty-state quality, or challenge discovery hierarchy.

#### Scenario: Arena asset-backed UI renders
- **WHEN** the Arena shell, hall summary, empty state, or challenge discovery card uses a visual image or generated asset
- **THEN** the asset SHALL be loaded from the centralized Arena visual-world directory
- **AND** the asset SHALL contain no required readable text
- **AND** the UI SHALL remain understandable when the asset is unavailable.

### Requirement: Arena workspace remains task-first
Arena hall and challenge detail pages SHALL remain dense task workspaces after shell and visual upgrades.

#### Scenario: Arena hall first viewport renders
- **WHEN** a student opens `/arena` on a normal desktop or wide projector-like viewport
- **THEN** challenge discovery, current challenge continuation when available, filters, and first task cards SHALL remain visible without scrolling past a decorative hero
- **AND** visual assets SHALL support the work hierarchy rather than replace task content.

#### Scenario: Arena challenge detail first viewport renders
- **WHEN** a student opens an Arena challenge detail page
- **THEN** challenge identity, route breadcrumb, evaluation context, and the primary workbench entry SHALL remain visible before secondary explanation or decorative visual content.
