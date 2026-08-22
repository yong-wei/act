## MODIFIED Requirements

### Requirement: Canonical paths are independently regenerated
When a formal ACT Teaching Projection matching the current Authority, course active-domain scope, CourseCoverage, reviewed KAQ bindings, and resource readiness is active, the planner SHALL generate a new path identity from the preserved goal, current cumulative portrait, and its supported Canonical teaching relations. An Engineering-only ActKG ReleaseSet, an ActKG Engineering relation set, an unresolved KAQ fallback conflict, or an unmatched Teaching Projection MUST NOT satisfy this gate.

#### Scenario: Teaching semantics are ready
- **WHEN** the matching ACT Teaching Projection and all other required Canonical planning inputs pass validation
- **THEN** the planner SHALL create a new path with Canonical IDs and versions and no inherited Legacy progress
- **AND** it SHALL consume only admitted ACT teaching relations from the selected projection

#### Scenario: Teaching semantics are unavailable
- **WHEN** the released graph lacks a matching formal ACT Teaching Projection or required teaching relations, or an applicable KAQ fallback conflict exists without a resolved matching retirement record
- **THEN** the planner SHALL keep the goal pending and MUST NOT infer a path from ActKG Engineering relations, an unmatched projection, or a Legacy fallback

#### Scenario: No KAQ fallback conflict exists
- **WHEN** the matching formal ACT Teaching Projection and all other Canonical planning inputs pass while no applicable KAQ fallback conflict exists
- **THEN** the absence of a conflict decision or retirement record SHALL NOT block independent path regeneration
- **AND** the planner SHALL consume only admitted ACT teaching relations from the selected projection
