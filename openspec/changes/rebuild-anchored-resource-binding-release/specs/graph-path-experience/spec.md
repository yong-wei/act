## MODIFIED Requirements

### Requirement: Learning paths consume bound resources in prerequisite order
The production learning-path pipeline SHALL match resources through explicit anchored graph bindings and SHALL respect applicable published prerequisite dependencies. Every selected resource SHALL retain a resolvable launch target that navigates to the bound anchor (step, handout heading, media time, textbook section), its actual resource type, and its `appearance` marker. Lesson entry pages SHALL NOT appear as path resources.

#### Scenario: Goal has bound resources and prerequisites
- **WHEN** a learning path is generated for the goal
- **THEN** eligible anchored bound resources SHALL be considered across supported resource families
- **AND** unresolved prerequisite knowledge SHALL precede its dependent knowledge or produce an explicit planning limitation
- **AND** each selected resource SHALL be openable through the existing resource launch contract at its anchored position

#### Scenario: Path node shows its anchor
- **WHEN** a path node is rendered for a media segment or handout section binding
- **THEN** the node SHALL display the anchor label (time range or section) and whether it is a first-appearance or revisit resource
