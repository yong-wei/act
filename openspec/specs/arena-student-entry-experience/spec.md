## Purpose
Define the student-facing Arena hall and challenge detail experience after the entry redesign.
## Requirements
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

### Requirement: Public entry points remove the review entry
The system SHALL remove the review entry from public student-facing navigation surfaces while preserving the internal `/review` route and review pages.

#### Scenario: Homepage no longer advertises review hub
- **WHEN** the homepage renders its module links and top navigation
- **THEN** no visible link SHALL be labeled `评审入口`
- **AND** no public module card SHALL link to `/review`.

### Requirement: Challenge detail page is a read-only challenge entry
The challenge detail page SHALL present challenge information, rules, related knowledge, leaderboard summary, and a unified control-workbench entry; it MUST NOT provide controller parameter submission or local simulation execution.

#### Scenario: Detail page has no submission form
- **WHEN** a challenge detail page renders
- **THEN** it SHALL NOT render `ArenaSubmissionPanel`
- **AND** it SHALL NOT render `ArenaBlackBoxSubmissionPanel`
- **AND** it SHALL render a single workbench entry link resolved from the task and object routing rules

#### Scenario: Workbench is the only official submit surface
- **WHEN** a student wants to submit a solution for a supported workbench challenge
- **THEN** the student SHALL submit through the corresponding workbench
- **AND** the challenge detail page SHALL only explain that simulation and submission occur in the control workbench

#### Scenario: Unified entry label
- **WHEN** the challenge detail page renders its primary workbench call to action
- **THEN** the visible button text MUST be `进入控制工作台`
- **AND** the page MUST NOT use old primary entry labels such as `进入多表征工作台`, `进入黑箱仿真`, or `进入 MPC 课程`

#### Scenario: Recommended method context remains visible
- **WHEN** the challenge detail page renders a task with allowed methods
- **THEN** it SHALL still show the allowed methods or recommended preset context
- **AND** this context MUST NOT replace the unified primary entry label

### Requirement: Challenge detail renders Chinese evaluation rules
The challenge detail page SHALL render evaluation rules in Chinese with ranking goals separated from hard constraints.

#### Scenario: Ranking metrics render as a table
- **WHEN** a metric profile has ranking metrics
- **THEN** the detail page SHALL render them in a dedicated basic-goal table
- **AND** each row SHALL include Chinese metric label, symbol when available, goal or accepted range, and explanation.

#### Scenario: Hard constraints render as Chinese module
- **WHEN** a metric profile has hard constraints
- **THEN** the detail page SHALL render them in a separate hard-constraint module
- **AND** no raw hard constraint id such as `closed_loop_stable` SHALL be visible to students.

### Requirement: White-box model expressions render as LaTeX
The system SHALL render white-box object model expressions with LaTeX on Arena pages.

#### Scenario: Transfer function is displayed as formula
- **WHEN** a white-box object exposes a transfer function model
- **THEN** the object description SHALL render the model expression through a LaTeX renderer
- **AND** the plain `display` string SHALL be used only as a fallback.

### Requirement: Student-visible leaderboard tabs are limited
Arena hall and challenge detail pages SHALL expose only main, method, and metric leaderboard views to students.

#### Scenario: Student leaderboard tabs are constrained
- **WHEN** an Arena page renders leaderboard tabs or filters
- **THEN** it SHALL show only `主榜`, `方法榜`, and `指标榜`
- **AND** it SHALL NOT show `Pareto 榜`, `班级榜`, or `赛季榜` on the student-facing page.

### Requirement: Leaderboard summaries are Chinese-only
Leaderboard summaries SHALL render Chinese labels and Chinese descriptions for ranking type, tie breakers, score state, and submission state.

#### Scenario: Summary hides raw policy fields
- **WHEN** a leaderboard policy includes tie breakers such as `hardConstraintPass` or `submittedAt`
- **THEN** the summary SHALL render Chinese labels such as `硬约束通过`, `得分`, and `提交时间`
- **AND** raw policy ids SHALL NOT be visible.

### Requirement: Arena hall uses unified control-workbench entry language
The Arena hall SHALL describe task entry with the unified control workbench concept rather than exposing legacy implementation routes.

#### Scenario: Task card entry language
- **WHEN** an Arena task card renders for a non-Odyssey task
- **THEN** it MUST use control-workbench entry language
- **AND** it MUST avoid presenting legacy route names as the primary student action

#### Scenario: Odyssey task card exception
- **WHEN** an Arena task card renders for a Control Odyssey task
- **THEN** it MAY preserve Odyssey-specific entry language
- **AND** it MUST still preserve the Arena task context in the link

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
