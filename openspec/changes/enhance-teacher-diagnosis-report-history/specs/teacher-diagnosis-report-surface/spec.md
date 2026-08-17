## ADDED Requirements

### Requirement: Teacher diagnosis history provides readable evidence summaries

The report surface SHALL preserve its existing governed fields and SHALL additionally show Chinese scope, included-student, main-weakness, availability, evidence-cutoff, and generation summaries in history entries. It SHALL NOT render raw answers, private dialogue, raw evidence JSON, parser output, or opaque evidence-reference identifiers.

#### Scenario: A source group is not supported by the snapshot contract

- **WHEN** a report does not expose governed coverage for 作业 or 测验
- **THEN** the surface SHALL mark that group as not available
- **AND** it SHALL show its included and missing counts as not provided rather than zero or complete coverage.

#### Scenario: A report has restricted confidence

- **WHEN** the selected report has medium, low, or unavailable confidence, partial coverage, a known limitation, or missing knowledge-node attribution
- **THEN** the surface SHALL show deterministic reasons and a recovery action
- **AND** it SHALL preserve the report's declared limitations without manufacturing a precise knowledge weak point.

### Requirement: Adjacent report comparison is governed

The surface SHALL compare a report only with its immediately older persisted report when class, target subject, scope, and diagnostic structure version match. It SHALL derive additions, persistence, risk escalation, and risk downgrade only from stable structured finding fields, not generated summary or finding prose.

#### Scenario: The selected report is the first available report

- **WHEN** there is no immediately older report
- **THEN** the surface SHALL show that no historical comparison baseline exists.

#### Scenario: Adjacent reports are structurally incompatible

- **WHEN** the immediately older report has a different scope or diagnostic structure version
- **THEN** the surface SHALL explain that comparison is unavailable
- **AND** it SHALL not fabricate a change result.

#### Scenario: A finding disappears from generated output

- **WHEN** an earlier stable finding has no matching current structured finding
- **THEN** the surface SHALL NOT label the disappearance as an improvement
- **AND** it SHALL limit improvement and downgrade claims to comparable severity transitions.
