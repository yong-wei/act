## ADDED Requirements

### Requirement: Navigation follows product journey layers
The system SHALL define navigation as layered product journeys rather than page-local route lists.

#### Scenario: A page renders navigation
- **WHEN** a public, student, workspace, teacher, admin, data, or report page renders
- **THEN** the visible navigation SHALL distinguish product orientation, role cockpit, contextual route trace, and local tools
- **AND** only the layers relevant to the page archetype SHALL receive primary visual weight.

#### Scenario: Navigation layers are checked against archetypes
- **WHEN** a route declares `public-entry`
- **THEN** product orientation SHALL be primary, role cockpit SHALL appear only as entry or account context, contextual route trace SHALL remain shallow, and local tools SHALL NOT dominate the first viewport
- **WHEN** a route declares `learning-atlas`
- **THEN** role cockpit and contextual route trace SHALL be primary, product orientation SHALL remain available as global context, and local tools SHALL be secondary to path discovery
- **WHEN** a route declares `mission-workspace`
- **THEN** contextual route trace and local tools SHALL be primary, role cockpit SHALL remain compact, and product orientation SHALL not compete with task execution
- **WHEN** a route declares `knowledge-data-map`
- **THEN** contextual route trace SHALL be primary, local tools SHALL support filtering or graph/data inspection, and role cockpit SHALL explain ownership or scope
- **WHEN** a route declares `operations-console`
- **THEN** role cockpit and local tools SHALL be primary, contextual route trace SHALL support repeated operator workflows, and product orientation SHALL remain secondary
- **WHEN** a route declares `report-ledger`
- **THEN** contextual route trace and local tools SHALL support evidence review, status filtering, and export actions, while role cockpit SHALL identify audience or governance scope.

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

#### Scenario: The student journey is reviewed
- **WHEN** student surfaces are reviewed for redesign acceptance
- **THEN** the journey SHALL connect Interactive Learning or adaptive entry to a learning path, lesson, Arena task, simulation, or learner record object
- **AND** the evidence source SHALL include progress, attempt, knowledge, profile, or report evidence
- **AND** the next action SHALL lead to study, practice, simulation, reflection, or report review.

#### Scenario: The teacher journey is reviewed
- **WHEN** teacher surfaces are reviewed for redesign acceptance
- **THEN** the journey SHALL connect teacher entry or class/course operations to lesson plans, class sessions, student groups, assignments, reports, or evidence review objects
- **AND** the evidence source SHALL include class activity, student progress, Arena, session, assessment, or report evidence
- **AND** the next action SHALL lead to preparation, teaching, intervention, assessment, feedback, or report export.

#### Scenario: The administrator journey is reviewed
- **WHEN** administrator surfaces are reviewed for redesign acceptance
- **THEN** the journey SHALL connect administrator entry or governance operations to users, courses, resources, data quality, governance snapshots, or exported review objects
- **AND** the evidence source SHALL include platform status, data coverage, governance ledger, audit, or report evidence
- **AND** the next action SHALL lead to configuration, quality review, governance decision, publication, or export.
