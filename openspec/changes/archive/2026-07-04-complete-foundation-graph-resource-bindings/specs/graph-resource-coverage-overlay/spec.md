## ADDED Requirements
### Requirement: Foundation graph resource bindings are completed in reviewed batches
The graph resource coverage workflow SHALL support bounded human-reviewed batches for foundational control-system graph nodes.

#### Scenario: Foundation batch is reviewed
- **WHEN** feedback, closed-loop, transfer-function, and time-domain foundation nodes are reviewed
- **THEN** accepted resource refs SHALL record source resource id, coverage role, citation/path distinction, reviewer-visible rationale, and version or source hash where available
- **AND** nodes without suitable resources SHALL retain explicit gap states.

#### Scenario: Baseline coverage is recalculated
- **WHEN** a foundation graph binding batch is completed
- **THEN** LearningGoal baseline coverage SHALL distinguish linked, human-confirmed, path-eligible, citation-ready, and blocked resources for the affected goals.
