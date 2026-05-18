## MODIFIED Requirements

### Requirement: Challenge detail exposes a switchable leaderboard browser
The challenge detail page SHALL provide a read-only leaderboard browser below the leaderboard summary with student-facing category controls for main, method, and metric rankings.

#### Scenario: Leaderboard categories are visible
- **WHEN** a student opens a challenge detail page with leaderboard data available
- **THEN** the leaderboard area SHALL show category controls labeled `主榜`, `方法榜`, and `指标榜`
- **AND** selecting a category SHALL update the detail leaderboard content without exposing an official submission form.

#### Scenario: Main leaderboard is the default detail view
- **WHEN** the challenge detail leaderboard browser first renders
- **THEN** the selected category SHALL be `主榜`
- **AND** the detail table SHALL show the official main ranking for that challenge.

#### Scenario: Category controls drive the detail table
- **WHEN** a student switches between `主榜`, `方法榜`, and `指标榜`
- **THEN** the leaderboard detail module SHALL replace the table content with rows for the selected board
- **AND** the summary module SHALL remain a compact overview rather than the only visible leaderboard detail.

### Requirement: Method and metric leaderboards expose sub-leaderboard selection
The challenge detail leaderboard browser SHALL expose second-level selection when the selected category contains multiple method or metric rankings.

#### Scenario: Method leaderboard has selectable methods
- **WHEN** a student selects `方法榜` and multiple method rankings are available
- **THEN** the browser SHALL show method sub-leaderboard controls
- **AND** selecting a method SHALL update the table to rows ranked within that method.

#### Scenario: Metric leaderboard has selectable metrics
- **WHEN** a student selects `指标榜` and multiple metric rankings are available
- **THEN** the browser SHALL show metric sub-leaderboard controls using Chinese metric labels and symbols when available
- **AND** selecting a metric SHALL update the table to rows ranked by that metric.

#### Scenario: Sub-leaderboard is unavailable
- **WHEN** the selected category has no available method or metric sub-leaderboard
- **THEN** the browser SHALL show a Chinese empty or unavailable state
- **AND** it SHALL NOT render a misleading empty ranking table without explanation.

### Requirement: Leaderboard detail rows identify students and metrics
Each challenge detail leaderboard row SHALL include enough student identity and metric information for academic comparison.

#### Scenario: Detail row fields render
- **WHEN** a leaderboard detail row is rendered
- **THEN** it SHALL show rank, student name, student number, score, selected metric values, and submitted time
- **AND** the metric values SHALL use the challenge metric labels rather than raw internal ids.

#### Scenario: Student number is missing
- **WHEN** a submission row has no available `StudentProfile.studentNumber`
- **THEN** the student number cell SHALL show a Chinese fallback
- **AND** the row SHALL still show the student name or stored student label.

#### Scenario: Identity cell is compact
- **WHEN** a leaderboard row displays student identity
- **THEN** the table SHALL show the student name as the main line and the student number as smaller secondary text in the same cell
- **AND** it SHALL NOT require separate wide columns for name and student number.

#### Scenario: Wide tables scroll horizontally
- **WHEN** a leaderboard table contains more metric columns than fit in the available width
- **THEN** the table container SHALL allow horizontal scrolling
- **AND** row content SHALL remain readable rather than squeezed into overlapping columns.

#### Scenario: Method sub-board omits redundant method column
- **WHEN** a specific method sub-leaderboard is selected
- **THEN** the table SHALL NOT show a repeated method column for every row
- **AND** the selected method SHALL remain visible in the sub-board control or table heading.

#### Scenario: Metric sub-board shows concrete metric value
- **WHEN** a specific metric sub-leaderboard is selected
- **THEN** each row SHALL show the concrete value for that selected metric
- **AND** the value SHALL use the challenge metric label and unit formatting when available.
