## ADDED Requirements

### Requirement: Navigation follows product journey layers
The system SHALL define navigation as layered product journeys rather than page-local route lists.

#### Scenario: A page renders navigation
- **WHEN** a public, student, workspace, teacher, admin, data, or report page renders
- **THEN** the visible navigation SHALL distinguish product orientation, role cockpit, contextual route trace, and local tools
- **AND** only the layers relevant to the page archetype SHALL receive primary visual weight.

### Requirement: Navigation style is unified across all stacks
The system SHALL apply one navigation style family across public, student, workspace, teacher, admin, knowledge, data, and report surfaces.

#### Scenario: User moves across page families
- **WHEN** a user moves between homepage, Interactive Learning, Arena, Control Workbench, knowledge graph, data center, teacher, admin, and report surfaces
- **THEN** navigation placement, route trace language, active state, account/cockpit semantics, and mobile collapse behavior SHALL remain recognizably consistent
- **AND** page-local sidebars or topbars SHALL NOT introduce a competing navigation language.

### Requirement: Role journeys connect UI surfaces to learning and governance outcomes
The system SHALL define student, teacher, and administrator journeys as connected workflows rather than disconnected route groups.

#### Scenario: A role journey is accepted
- **WHEN** a primary student, teacher, or administrator journey is added to the route inventory
- **THEN** it SHALL identify the entry route, role, business object, evidence source, next action, and report or governance destination
- **AND** surfaces that only display decorative cards or metrics without a next action SHALL fail the journey acceptance rule.
