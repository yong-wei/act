## ADDED Requirements

### Requirement: Workbench compares existing control metrics across visible designs
The classic four-view workbench SHALL display the current editable design and every visible design snapshot as identifiable columns in a key-performance-metric comparison. The comparison SHALL use only metrics already returned by each design's control analysis and SHALL include overshoot, rise time, settling time, peak time, final value, phase margin, gain margin, gain crossover frequency, phase crossover frequency, and bandwidth.

#### Scenario: Student compares current and saved designs
- **WHEN** at least one visible snapshot and the current design have completed analysis
- **THEN** the workbench SHALL display their existing time-domain and frequency-domain metric values in one comparison
- **AND** each design SHALL use the same name and stable color shown by the snapshot manager and chart legends.

#### Scenario: No snapshot is visible
- **WHEN** the student has no visible design snapshot
- **THEN** the comparison area SHALL explain that a snapshot must be saved and shown before comparison
- **AND** it SHALL NOT present the current design alone as a multi-design comparison.

### Requirement: Student can select a valid comparison baseline
The comparison SHALL allow the student to select the current design or any visible snapshot as the baseline. The first visible snapshot SHALL be the default baseline, and an invalidated snapshot baseline SHALL be replaced by the earliest remaining visible snapshot or by the current design when no visible snapshot remains.

#### Scenario: First snapshot becomes visible
- **WHEN** a comparison has no visible snapshot and a first snapshot becomes visible
- **THEN** that snapshot SHALL become the comparison baseline.

#### Scenario: Baseline snapshot is hidden or deleted
- **WHEN** the current baseline snapshot is hidden or deleted
- **THEN** the earliest remaining visible snapshot SHALL become the baseline
- **AND** the current design SHALL become the baseline only when no visible snapshot remains.

#### Scenario: Baseline snapshot is renamed or restored
- **WHEN** the student renames a baseline snapshot or restores it into the current editable design
- **THEN** the saved snapshot SHALL retain its baseline identity and updated visible name
- **AND** restoration SHALL NOT merge the snapshot identity with the current design.

### Requirement: Metric differences preserve units and remain evaluatively neutral
Every non-baseline ready value SHALL show its signed difference from the corresponding ready baseline value. Overshoot differences SHALL use percentage points, while other differences SHALL retain the source metric unit. The comparison SHALL NOT assign aggregate scores, best-design labels, or task-constraint outcomes.

#### Scenario: Overshoot differs from baseline
- **WHEN** a design overshoot is 18.2 percent and the baseline overshoot is 14.1 percent
- **THEN** the comparison SHALL show a difference of `+4.1 个百分点`
- **AND** it SHALL NOT describe the difference as a 4.1 percent relative change.

#### Scenario: Control metrics expose a trade-off
- **WHEN** one design improves a response-time metric while reducing a stability-margin metric
- **THEN** the comparison SHALL display both signed differences without declaring either design better.

### Requirement: Comparison distinguishes analysis and metric availability states
The comparison SHALL distinguish a design that is computing, a design whose analysis failed, a metric that is not applicable to the response type, unavailable analysis data, and a phase crossover not observed in the current frequency range. A pending or failed design SHALL NOT display a previous result as current.

#### Scenario: Snapshot analysis is pending
- **WHEN** a visible snapshot analysis has not completed
- **THEN** its comparison column SHALL display a computing state
- **AND** it SHALL NOT display values retained from an earlier analysis state.

#### Scenario: Snapshot analysis fails
- **WHEN** a visible snapshot analysis fails
- **THEN** its comparison column SHALL display an analysis-failed state distinct from computing and unavailable metric states.

#### Scenario: Phase crossover is not observed
- **WHEN** the analysis reports `notObservedInFrequencyRange`
- **THEN** gain-margin and phase-crossover presentation SHALL state that phase crossover was not observed in the current frequency range
- **AND** it SHALL NOT represent the condition as missing analysis data or infinite gain margin.

### Requirement: Comparison remains readable on narrow screens
The comparison SHALL preserve readable metric names, values, units, design names, and baseline controls on desktop and at a 320-pixel viewport.

#### Scenario: Comparison opens at 320 pixels
- **WHEN** the student views multiple design columns at a 320-pixel viewport
- **THEN** the comparison SHALL provide horizontal access to every complete column
- **AND** it SHALL NOT compress metric names, values, or units into unreadable content.

### Requirement: Comparison does not alter official submission
The metric comparison SHALL remain read-only presentation state and SHALL NOT add snapshots, baseline identity, or comparison values to Arena evaluation or official submission inputs.

#### Scenario: Student submits after metric comparison
- **WHEN** the student submits from an Arena-bound classic workbench after comparing multiple snapshots
- **THEN** the official artifact SHALL still be built only from the current editable design.
