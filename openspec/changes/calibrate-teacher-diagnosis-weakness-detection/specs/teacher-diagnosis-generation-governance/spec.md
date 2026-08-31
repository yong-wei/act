## ADDED Requirements

### Requirement: Knowledge-node weakness findings require minimum absolute-weakness evidence

The diagnosis generation contract SHALL require every knowledge-node weakness finding (a finding citing `knowledge-progress` evidence, with or without an explicit `knowledgeNodeId`, consistent with the attribution-gate scope) to be anchored to a node with minimum absolute-weakness evidence in the governed input, and SHALL enforce this with a deterministic post-generation validation that rejects the output as a retryable model-behavior defect instead of persisting it. An absolute-weakness progress row is a row whose status is `NOT_STARTED`, or whose progress is below 40 and whose status is not `COMPLETED`. The rule selection SHALL depend on the diagnosis scope type, not on class size: class-level diagnosis qualifies a node only when its weak rows cover at least `max(3, ceil(20% of the students having progress rows for that node))` students — including a class with a single enrolled student, which fails closed — while single-student diagnosis (a request with an explicit target student) qualifies a node only when the target student's row for that node is itself weak. The provider tool results SHALL include a per-node deterministic weakness projection (`weakStudentCount`, `coveredStudentCount`, `minimumWeakStudents`, `eligibleForWeaknessFinding`) so the provider can follow the same judgment the deterministic gate enforces, instead of estimating weak-student counts from aggregated progress.

#### Scenario: Healthy class produces no knowledge-node findings

- **WHEN** every knowledge node's progress rows are completed or at progress >= 40, and the provider returns a report containing a knowledge-node weakness finding
- **THEN** the system SHALL reject the output with the calibration failure code and retry within the existing attempt budget
- **AND** SHALL NOT persist the report; a healthy class SHALL structurally admit zero knowledge-node false positives.

#### Scenario: Relatively-lowest but normal node is not reported as weak

- **WHEN** a node is the lowest in the class but its rows satisfy neither the weak-row definition nor the minimum-evidence threshold
- **THEN** a knowledge-node weakness finding for that node SHALL be rejected by the deterministic validation
- **AND** the class-relative lowness SHALL NOT by itself justify a weakness finding.

#### Scenario: Genuine weakness satisfies the minimum evidence

- **WHEN** a node has weak rows covering at least the class-level minimum threshold
- **THEN** a knowledge-node weakness finding anchored to that node SHALL pass the calibration validation and remain eligible for persistence through the ordinary governed path.

#### Scenario: Boundary and single-student diagnosis

- **WHEN** a node's weak-row count equals the threshold minus one, or a single-student diagnosis targets a student whose row for the node is completed or at progress >= 40
- **THEN** a knowledge-node weakness finding for that node SHALL be rejected by the calibration validation.

#### Scenario: One-student class-level diagnosis fails closed

- **WHEN** a teacher launches a class-level diagnosis for a class with exactly one enrolled student whose row for a node is weak, and the provider returns a knowledge-node weakness finding for that node
- **THEN** the class-level threshold of at least three weak students SHALL apply and the finding SHALL be rejected
- **AND** the single-student rule SHALL NOT be selected merely because the diagnosed student set has size one.

#### Scenario: Provider receives the deterministic weakness projection

- **WHEN** the governed tool results are projected for the provider
- **THEN** the knowledge-progress tool result SHALL carry per-node `weakStudentCount`, `coveredStudentCount`, `minimumWeakStudents`, and `eligibleForWeaknessFinding` computed from the same weak-row definition and threshold the deterministic gate enforces.

### Requirement: Evidence coverage gaps downgrade report confidence and force limitations

The diagnosis generation contract SHALL require that, when any knowledge-node finding cites a node whose progress rows cover fewer students than the diagnosed student set, the report's top-level `confidence` SHALL NOT be `high` and the `limitations` array SHALL be non-empty; the deterministic validation SHALL reject an output violating either constraint as a retryable model-behavior defect.

#### Scenario: Thirty percent of progress rows are missing

- **WHEN** a knowledge-node finding cites a node with partial progress coverage and the provider returns `confidence: high` or empty `limitations`
- **THEN** the system SHALL reject the output with the calibration failure code and retry within the existing attempt budget.

#### Scenario: Conflicting assignment and assessment evidence

- **WHEN** assignment and assessment evidence conflict for a reported conclusion
- **THEN** the system prompt SHALL direct the provider to record the conflict in `limitations` and lower the conclusion strength instead of issuing a one-sided strong conclusion
- **AND** the report SHALL NOT widen the weakness set beyond what the minimum absolute-weakness evidence supports.

### Requirement: Provider prompt encodes weakness-calibration tiers

The diagnosis system prompt SHALL instruct the provider that knowledge-node weakness requires absolute-weakness anchoring, that class-relative but normal nodes are not weaknesses, that empty findings with an explicit "no clear weakness identified" summary are the correct output for healthy classes, and that evidence conflicts or coverage gaps must be surfaced through limitations and reduced confidence rather than by expanding the weakness set.

#### Scenario: Healthy class summary

- **WHEN** the governed input contains no node satisfying the minimum absolute-weakness evidence
- **THEN** the provider SHALL be directed to return empty or non-knowledge-node findings with a Simplified-Chinese summary stating that no clear weakness was identified
- **AND** the deterministic calibration gate SHALL keep the structural no-false-positive guarantee regardless of provider compliance.
