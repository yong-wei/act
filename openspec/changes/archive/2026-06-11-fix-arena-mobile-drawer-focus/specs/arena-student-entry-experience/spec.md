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

#### Scenario: Mobile drawer keeps keyboard focus inside navigation
- **WHEN** a student opens the Arena mobile drawer
- **THEN** keyboard focus SHALL move into the drawer
- **AND** Tab and Shift+Tab navigation SHALL remain within drawer controls until the drawer closes
- **AND** Escape SHALL close the drawer
- **AND** the underlying shell content SHALL NOT remain reachable by keyboard navigation while the drawer is open
- **AND** closing the drawer SHALL restore focus to the drawer opener when it is still available
- **AND** entering the desktop navigation breakpoint while the drawer is open SHALL close the mobile drawer before the hidden dialog can keep shell content inert.
