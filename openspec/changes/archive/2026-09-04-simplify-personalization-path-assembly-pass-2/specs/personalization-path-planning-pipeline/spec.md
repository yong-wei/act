## ADDED Requirements

### Requirement: Path assembly pass 2 preserves behavior and reduces the implementation
The system SHALL simplify the existing canonical path assembly pipeline without adding another planner or changing its public contract. For the same inputs and stored state, the simplified pipeline MUST preserve path membership, order, eligibility, prerequisite repair, redaction, explanation, errors, and persistence effects. The completed change MUST reduce total path-planning production code or internal control-state complexity; moving the same logic between files is not sufficient.

#### Scenario: Existing path cases are replayed
- **WHEN** the current characterization cases run before and after the simplification
- **THEN** their returned paths, explanations, errors, ordering, and persistence effects are equivalent

#### Scenario: A proposed extraction only moves code
- **WHEN** a proposed change leaves total production logic and internal state complexity unchanged
- **THEN** the change is not accepted as completion of this requirement
