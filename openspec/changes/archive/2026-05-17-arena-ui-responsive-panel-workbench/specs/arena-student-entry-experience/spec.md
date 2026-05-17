## ADDED Requirements

### Requirement: Arena hall uses compact responsive challenge layout
The Arena hall SHALL reduce wasted space and render challenge discovery as a compact responsive card grid.

#### Scenario: Desktop hall uses equal title and search regions
- **WHEN** a student opens `/arena` on a desktop-width viewport
- **THEN** the title/status region and search/filter region SHALL render as equal-height, equal-width layout peers
- **AND** the challenge cards SHALL be visible without requiring excessive vertical scrolling past a large hero area.

#### Scenario: Desktop hall renders two challenge columns
- **WHEN** the hall has two or more visible challenges on a desktop-width viewport
- **THEN** the challenges SHALL render in two card columns
- **AND** each card SHALL keep its primary entry action and key status readable.

#### Scenario: Narrow hall remains readable
- **WHEN** a student opens `/arena` on a narrow viewport
- **THEN** the challenge grid SHALL collapse to one column
- **AND** search/filter controls SHALL remain usable without horizontal scrolling.

### Requirement: Arena pages adapt page and card backgrounds to theme
Arena hall and challenge detail pages SHALL use theme-aware backgrounds, surfaces, and text colors.

#### Scenario: Light mode does not render dark fixed navigation
- **WHEN** a student opens an Arena page in light mode
- **THEN** the left navigation SHALL use light-mode surface and text tokens
- **AND** it SHALL NOT remain a dark fixed sidebar.

#### Scenario: Dark mode does not render white content surfaces
- **WHEN** a student opens an Arena hall or challenge detail page in dark mode
- **THEN** the page background and primary content cards SHALL use dark-mode surfaces
- **AND** white page or card backgrounds SHALL NOT be visible.

## MODIFIED Requirements

### Requirement: Arena pages provide a consistent student navigation shell
The system SHALL render the Arena hall and challenge detail pages with a consistent student-facing shell that includes a theme-aware left project-entry navigation, a top breadcrumb derived from the real route path, and a right-side personal-center entry matching the homepage pattern.

#### Scenario: Hall breadcrumb and project entries render
- **WHEN** a student opens `/arena`
- **THEN** the page SHALL show the breadcrumb labels `首页` and `竞技场首页`
- **AND** the left navigation SHALL include exactly the four homepage project entries `虚拟仿真`, `竞技场`, `知识图谱`, and `互动学习`
- **AND** the right side SHALL expose the same personal-center entry pattern used on the homepage
- **AND** the left navigation SHALL NOT include a review entry.

#### Scenario: Detail breadcrumb renders challenge name
- **WHEN** a student opens `/arena/challenges/task-second-order-lead-pid`
- **THEN** the page SHALL show the breadcrumb labels `首页`, `竞技场首页`, and the concrete challenge name
- **AND** the breadcrumb SHALL preserve navigation back to `/` and `/arena`
- **AND** the right side SHALL continue to expose the personal-center entry.
