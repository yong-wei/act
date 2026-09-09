## MODIFIED Requirements

### Requirement: Path planner consumes the unified ResourceNode registry
Adaptive path generation SHALL consume the same governed ResourceNode registry projection used by the resource center and data-completeness helper.

#### Scenario: Planner loads candidate resources
- **WHEN** a student requests a path for any registered LearningGoal
- **THEN** the path-generation entrypoint SHALL load audited ResourceNodes from registered resources, runtime lesson projections, runtime lessons, media and handout dispositions, textbook or reference PlanningUnits, generated checkpoint contracts, and teaching-projection binding adaptations through one governed loader
- **AND** it SHALL report registry version, projection version, and candidate counts by resource family, including the teaching-projection binding family.

#### Scenario: Partial registry would hide resources
- **WHEN** a production entrypoint can only see registered resources or textbook catalog rows but runtime projections also exist
- **THEN** diagnostics SHALL report the missing source family
- **AND** the generated path SHALL be marked limited rather than presented as a complete resource-aware recommendation.

#### Scenario: Teaching-projection binding input is unavailable
- **WHEN** the teaching-projection binding adapter cannot load its projection or bridge inputs
- **THEN** diagnostics SHALL report the teaching-projection binding family as missing or limited
- **AND** the generated path SHALL be marked limited rather than silently omitting that resource family.

#### Scenario: Retrieval-only record ranks highly
- **WHEN** a retrieval chunk, search document, figure, caption, transcript segment, or citation target is relevant to the LearningGoal
- **THEN** the planner MAY use it as ranking or citation support
- **AND** it SHALL NOT promote that record to a PathNode unless an audited ResourceNode or checkpoint contract authorizes path eligibility.

## ADDED Requirements

### Requirement: Planner goal matching includes canonical targets through the governed id bridge
`nodeMatchesGoal` SHALL admit canonical goal targets by resolving them through the governed cutover denominator bridge to legacy node ids before comparison. Planning internals SHALL keep legacy ResourceNode ids as identity; canonical ids are matching, ranking, and explanation signals only. Canonical targets without a bridge row SHALL NOT match and SHALL surface as a diagnostic limitation.

#### Scenario: Canonical target matches a governed node
- **WHEN** a requested LearningGoal includes a canonical target that the bridge resolves to a legacy node id covered by an admitted ResourceNode
- **THEN** the planner SHALL treat that node as goal-matching
- **AND** the path rationale SHALL cite the canonical id alongside the ResourceNode identity

#### Scenario: Canonical target is unresolvable
- **WHEN** a requested LearningGoal includes a canonical target with no denominator bridge row
- **THEN** the planner SHALL NOT match any candidate to that target
- **AND** diagnostics SHALL report the unresolvable canonical target as a limitation

### Requirement: LearningGoal resource mix may include reviewed media and exercise families
Registered LearningGoal `allowedResourceMix` definitions MAY include video, audio, and exercise resource families. A mix extension SHALL take effect only after the path-readiness review batch covers the added family for that goal's resource scope; until then the admission layer SHALL keep family members excluded-with-rationale. Mix definitions MUST NOT bypass audit or review admission.

#### Scenario: Reviewed video nodes enter the mix
- **WHEN** a registered LearningGoal mix lists video and the review batch covers the goal's video nodes
- **THEN** the planner MAY select reviewed video nodes for that goal
- **AND** selected and rejected reasons SHALL name the resource family

#### Scenario: Mix lists a family whose review coverage is incomplete
- **WHEN** a registered LearningGoal mix lists exercise but the goal's exercise nodes lack review-batch coverage
- **THEN** those exercise nodes SHALL remain excluded-with-rationale blocking
- **AND** diagnostics SHALL report the missing review coverage instead of fabricating eligibility

### Requirement: Projection-adapted candidates never bypass admission gates
Candidates whose canonical binding signals come from the teaching-projection binding adapter SHALL pass the same `pathEligible` audit, high-confidence audit, and review-batch gates as every other candidate family. The adapter MUST NOT grant hard eligibility, mastery, completion, or mix membership by itself.

#### Scenario: Adapted node fails audit
- **WHEN** a node carrying adapter-supplied canonical bindings fails the resource audit
- **THEN** it SHALL remain excluded before ranking and repair
- **AND** ranking and explanation SHALL NOT reintroduce it as an executable path node

#### Scenario: Konling path request consumes adapted candidates
- **WHEN** a governed Konling path tool generates a path after the binding family is loaded
- **THEN** the resulting path options MAY include handouts, cards, videos, audio, exercises, simulations, and textbook sections
- **AND** every selected node SHALL trace to an audited, review-covered ResourceNode
