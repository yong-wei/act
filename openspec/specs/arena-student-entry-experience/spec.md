## Purpose
Define the student-facing Arena hall and challenge detail experience after the entry redesign.

## Requirements

### Requirement: Arena pages provide a consistent student navigation shell
The system SHALL render the Arena hall and challenge detail pages with a consistent student-facing shell that includes a left project-entry navigation and a top breadcrumb derived from the real route path.

#### Scenario: Hall breadcrumb and project entries render
- **WHEN** a student opens `/arena`
- **THEN** the page SHALL show a breadcrumb for `/` to `/arena`
- **AND** the left navigation SHALL include current project entries such as Arena, simulations, interactive learning, knowledge graph, AI, missions, and profile
- **AND** the left navigation SHALL NOT include a review entry.

#### Scenario: Detail breadcrumb renders task path
- **WHEN** a student opens `/arena/challenges/task-second-order-lead-pid`
- **THEN** the page SHALL show a breadcrumb for `/` to `/arena` to `/arena/challenges/task-second-order-lead-pid`.

### Requirement: Public entry points remove the review entry
The system SHALL remove the review entry from public student-facing navigation surfaces while preserving the internal `/review` route and review pages.

#### Scenario: Homepage no longer advertises review hub
- **WHEN** the homepage renders its module links and top navigation
- **THEN** no visible link SHALL be labeled `评审入口`
- **AND** no public module card SHALL link to `/review`.

### Requirement: Challenge detail page is a read-only challenge entry
The challenge detail page SHALL present challenge information, rules, related knowledge, leaderboard summary, and a workbench entry; it MUST NOT provide controller parameter submission or local simulation execution.

#### Scenario: Detail page has no submission form
- **WHEN** a challenge detail page renders
- **THEN** it SHALL NOT render `ArenaSubmissionPanel`
- **AND** it SHALL NOT render `ArenaBlackBoxSubmissionPanel`
- **AND** it SHALL render a single workbench entry link resolved from the task workspace mode.

#### Scenario: Workbench is the only official submit surface
- **WHEN** a student wants to submit a solution for a supported workbench challenge
- **THEN** the student SHALL submit through the corresponding workbench
- **AND** the challenge detail page SHALL only explain that simulation and submission occur in the workbench.

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
