## ADDED Requirements
### Requirement: Analysis and design graph resource bindings are completed in reviewed batches
The graph resource coverage workflow SHALL support bounded human-reviewed batches for analysis and controller-design graph nodes.

#### Scenario: Analysis and design batch is reviewed
- **WHEN** stability, steady-state error, root-locus, frequency-response, margin, and correction-design nodes are reviewed
- **THEN** accepted resource refs SHALL declare coverage role, graph-node relation, LearningGoal fit, reviewer rationale, and version or source hash where available
- **AND** checkpoint, remediation, and terminal-validation candidates SHALL remain candidates until their own resource or assessment reviews approve them.

#### Scenario: Missing design coverage remains visible
- **WHEN** a target graph node lacks suitable resources after review
- **THEN** the coverage overlay SHALL expose a precise resource gap rather than counting provisional suggestions as coverage.
