## MODIFIED Requirements

### Requirement: Platform data center separates presentation and governance modes
The system SHALL provide platform data center UI contracts that distinguish presentation-ready aggregate metrics from admin governance details.

#### Scenario: User opens presentation data center
- **WHEN** an authorized teacher or administrator opens `/data-center` or a presentation-mode data center entry
- **THEN** the UI SHALL show aggregate platform metrics, module activity, learning trajectory summaries, simulation/Arena activity, classroom activity, and snapshot-ready charts where data is available
- **AND** it SHALL identify whether each metric is real, partial, stale, or restricted.
- **AND** visible demo-source labels SHALL be controlled by administrator display policy rather than always shown in ordinary presentation UI.

### Requirement: Data center snapshots are privacy-safe
The system SHALL keep exported or screenshot-oriented data-center summaries privacy-safe and source-marked.

#### Scenario: Presentation snapshot is generated
- **WHEN** a data-center summary is exported, captured, or prepared for presentation
- **THEN** it SHALL remove raw learner evidence, raw high-frequency traces, hidden official evaluation internals, raw answers, and private memory
- **AND** it SHALL retain source quality markers for demo, real, partial, stale, or restricted metrics.
- **AND** demo source quality SHALL remain available in snapshot, export, or governance contexts even when ordinary UI hides the visible demo label.

### Requirement: Demo source labels follow administrator display policy
Data center UI SHALL hide or show visible demo-source labels according to administrator policy without changing source truth.

#### Scenario: Demo label display is disabled
- **WHEN** ordinary data-center presentation UI renders with demo-label display disabled or unset
- **THEN** visible source markers SHALL NOT display a "demo data" tag for demo metrics.
- **AND** internal source quality, provenance, source family, audit, and export semantics SHALL still classify the metric as demo.

#### Scenario: Demo label display is enabled
- **WHEN** ordinary data-center presentation UI renders with demo-label display enabled
- **THEN** visible source markers SHALL display the demo-source marker using shared source-quality semantics.
- **AND** the setting SHALL NOT change metric values, evidence scoring, source coverage, or governance classification.
