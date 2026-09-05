## MODIFIED Requirements

### Requirement: Published teaching order is the default domain relation layer
A domain's initial relation view SHALL enable every available published ACT_TEACHING containment, prerequisite, and pedagogical-association family by default. Every ActKG engineering family SHALL remain disabled until requested. Runtime presentation SHALL display only published teaching edges and SHALL NOT infer order from live engineering shards, object names, course order, or layout. Build-time adoption of engineering post-requisites into the Teaching Projection is required by `domain-teaching-order-coverage` and is not a runtime inference. Teaching service unavailability SHALL NOT block primary Authority object selection or engineering relation filters and SHALL NOT expose repository review-pack state in the runtime product.

#### Scenario: Domain has published teaching edges
- **WHEN** a version-matched Teaching Projection contains published teaching relations for the active domain
- **THEN** its available containment, prerequisite, and pedagogical-association families SHALL be visible by default with registered direction and layer meaning
- **AND** every engineering family SHALL remain off until the viewer enables it

#### Scenario: Domain has no published teaching edge
- **WHEN** the domain teaching coverage is empty, partial, or unavailable
- **THEN** primary Authority objects SHALL remain visible and selectable and the product SHALL show only valid published teaching edges that are actually present
- **AND** the workspace SHALL not infer order from live engineering relations, object names, course order, layout, or repository review candidates

#### Scenario: Domain teaching overlay is unavailable
- **WHEN** the domain teaching coverage cannot be resolved as a published overlay
- **THEN** primary Authority objects SHALL remain visible and selectable
- **AND** the workspace SHALL not infer order from live engineering relations, object names, course order, layout, or repository review candidates
