## ADDED Requirements

### Requirement: Full resource path-readiness gate is available
The system SHALL provide a full-resource path-readiness gate that verifies every discovered resource has an effective planning disposition before the platform is declared resource-complete.

#### Scenario: Full readiness gate runs
- **WHEN** the full-resource readiness gate runs
- **THEN** it SHALL consume data-completeness helper output and ResourceNode registry audit output
- **AND** it SHALL fail on missing disposition, invalid PathNode promotion, missing reviewed semantic fields, missing parent PlanningUnit for embedded assets, missing exclusion rationale, or unresolved path blocker for a path-plannable resource.
- **AND** it SHALL preserve summarized evidence including resource family totals, unaccounted count, invalid promotion count, unreviewed semantic count, evidence-lineage blockers, follow-up buckets, and learner fixture blockers.

#### Scenario: New resource import is incomplete
- **WHEN** a new TeachingResource, runtime lesson, knowledge card, infograph, simulation, control workbench entry, Arena resource, quiz, exercise, textbook, reference, figure, transcript, slide, media anchor, or image description is added without reviewed path-planning disposition
- **THEN** the helper or gate SHALL report it as incomplete
- **AND** the resource SHALL NOT silently bypass path-readiness auditing.
