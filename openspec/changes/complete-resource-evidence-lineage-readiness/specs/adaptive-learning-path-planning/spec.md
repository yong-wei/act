## ADDED Requirements

### Requirement: Planner respects evidence-lineage readiness
The adaptive path planner SHALL distinguish selectable learning resources from resources whose evidence effects are blocked by incomplete lineage.

#### Scenario: Resource lacks evidence lineage
- **WHEN** a resource is otherwise relevant but lacks required evidence-lineage behavior for its planned role
- **THEN** the planner SHALL either select it only as non-mastery learning content with a limitation or reject it for evidence-producing roles
- **AND** it SHALL expose the limitation in authorized diagnostics.
