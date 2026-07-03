## ADDED Requirements

### Requirement: All registered LearningGoals have path-generation diagnostics
The adaptive path planner SHALL expose diagnostics proving every backend-registered LearningGoal can generate paths from governed resources or report a narrowly explained resource gap.

#### Scenario: All-goal path diagnostic runs
- **WHEN** the all-goal path diagnostic runs
- **THEN** it SHALL enumerate LearningGoals from the backend registry rather than hard-coded frontend names
- **AND** it SHALL attempt path generation for every registered goal using audited ResourceNodes, checkpoint nodes, and reviewed resource policies.

#### Scenario: Goal has sufficient governed resources
- **WHEN** a LearningGoal has multiple reviewed resources across compatible resource families
- **THEN** generated paths SHALL include a meaningful governed resource mix according to policy
- **AND** they SHALL NOT collapse to a single-resource fallback or cosmetic variants.

#### Scenario: Goal lacks resources after full audit
- **WHEN** a LearningGoal still lacks sufficient path resources after all resources are classified
- **THEN** diagnostics SHALL report the exact missing graph, resource, evidence, citation, or policy dimension
- **AND** the student-facing path surface SHALL receive an actionable low-resource state rather than a permission-style failure.
 
### Requirement: Path explanations cite governed selected and supporting resources
Generated path explanations and Konling path advice SHALL cite governed resources used by the planner.

#### Scenario: Path explanation includes resource evidence
- **WHEN** a path option is generated from selected ResourceNodes and supporting citations
- **THEN** its explanation payload SHALL include verified or limitation-marked citation refs for selected and supporting resources
- **AND** citation links SHALL resolve through server-owned citation metadata.
