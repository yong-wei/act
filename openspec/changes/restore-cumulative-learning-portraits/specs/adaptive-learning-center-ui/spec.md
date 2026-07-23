## ADDED Requirements

### Requirement: Student portrait surfaces render the canonical cumulative state
Student profile and growth surfaces SHALL render the canonical cumulative
portrait, overall diagnosis, last trend, last risk, cumulative evidence
summary, newest activity, and meaningful growth events from one learner-state
response.

#### Scenario: Learner has cumulative evidence without newer activity
- **WHEN** a learner with a valid cumulative portrait opens profile or growth without newer facts
- **THEN** the page SHALL display the existing portrait values, overall level, diagnosis, trend, risk, and evidence cutoff
- **AND** it SHALL NOT create an activity-window portrait, empty state, risk, trend, or diagnosis.

#### Scenario: Learner has partial dimension coverage
- **WHEN** a learner has valid evidence for only some portrait dimensions
- **THEN** the page SHALL display values for evidenced dimensions and identify missing dimensions separately
- **AND** it SHALL NOT render missing dimensions as zero or hide the entire portrait.

#### Scenario: Learner opens growth history
- **WHEN** meaningful cumulative growth events exist
- **THEN** the growth surface SHALL show those events in newest-first order with evidence type and occurrence time
- **AND** ordinary activity records SHALL remain available through the paginated evidence or activity view rather than being duplicated as growth events.

#### Scenario: Removed recent portrait route or control is requested
- **WHEN** a client requests a removed recent portrait API, query scope, route, or UI control
- **THEN** the system SHALL return an explicit unsupported-scope or removed-contract outcome
- **AND** it SHALL NOT silently render the cumulative portrait as if the recent request were accepted.

### Requirement: Learning portrait surfaces use explicit availability states
Student and teacher learning portrait surfaces SHALL preserve every available
section and explain unavailable sections with specific product-facing reasons
and actions.

#### Scenario: One section is unavailable
- **WHEN** portrait data exists but one of comparison, recommendation, growth, risk, or activity is unavailable
- **THEN** the page SHALL continue to render the available portrait and diagnosis sections
- **AND** the unavailable section SHALL show its specific reason and an applicable action instead of a generic `暂无`, `待生成`, or `无证据` message.

#### Scenario: Reconciliation is available
- **WHEN** the current user is allowed to reconcile the learner portrait
- **THEN** the page SHALL provide an update action and show queued, processing, completed, no-change, or failed status
- **AND** repeated activation SHALL reuse the idempotent learner-scoped task.

### Requirement: Teacher portrait surfaces render overall cumulative diagnosis
Teacher student-detail and class-insight surfaces SHALL use the canonical
cumulative contracts for their primary cards and SHALL present goal-specific
diagnoses only as subordinate drilldowns.

#### Scenario: Teacher opens a student detail
- **WHEN** an authorized teacher opens a current class member with cumulative portrait data
- **THEN** the page SHALL show overall level, seven-dimension coverage, strengths, improvement areas, last trend, last risk, cumulative evidence, growth summary, class comparisons where available, and evidence cutoff
- **AND** a control-correction diagnosis SHALL NOT replace the overall diagnosis.

#### Scenario: Teacher opens a class insight
- **WHEN** an authorized teacher opens a class containing members with cumulative portraits
- **THEN** the page SHALL show overall coverage, seven-dimension aggregates, trend distribution, risk distribution, strengths, improvement clusters, cumulative evidence summary, and member drilldowns
- **AND** members without a dimension SHALL be reported as missing rather than marked `累计口径不适用` or assigned zero.
