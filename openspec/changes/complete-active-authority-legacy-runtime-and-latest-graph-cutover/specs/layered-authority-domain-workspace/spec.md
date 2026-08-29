## MODIFIED Requirements

### Requirement: Published teaching order is the default domain relation layer
A domain's initial relation view SHALL enable every available published ACT_TEACHING containment, prerequisite, and pedagogical-association family by default. Every ActKG engineering family SHALL remain disabled until requested. Teaching coverage that is partial, empty, unavailable, or mismatched SHALL NOT block truthful base Authority object selection in a predecessor, diagnostic, candidate, or failed-cutover state, SHALL NOT cause engineering relations to be restated as teaching, and SHALL NOT expose repository review-pack state in the runtime product. A production cutover to the execution-time latest coherent combination SHALL NOT qualify as complete unless the exact active Authority has a complete, matching, non-empty Teaching Projection and composed domain fragments available to the workspace.

#### Scenario: Domain has published teaching edges
- **WHEN** a version-matched Teaching Projection contains published teaching relations for the active domain
- **THEN** its available containment, prerequisite, and pedagogical-association families SHALL be visible by default with registered direction and layer meaning
- **AND** every engineering family SHALL remain off until the viewer enables it

#### Scenario: Domain has no published teaching edge outside a qualified latest cutover
- **WHEN** the domain teaching coverage is empty, partial, unavailable, or mismatched in a predecessor, diagnostic, candidate, or failed-cutover state
- **THEN** eligible primary Authority objects MAY remain visible and selectable with an explicit truthful availability state
- **AND** the workspace SHALL NOT infer order from engineering relations, object names, course order, layout, database relations, or repository review candidates

#### Scenario: Latest production combination lacks complete teaching fragments
- **WHEN** a coordinated latest production activation is offered but its Teaching Projection or composed domain fragments are missing, partial, empty, stale, or bound to another identity
- **THEN** `/knowledge` production-cutover readiness SHALL be false and the activation SHALL NOT be reported as product-complete
- **AND** “教学关系暂不可用” SHALL NOT be accepted as successful latest-graph delivery

#### Scenario: Latest production combination is complete
- **WHEN** the active coordinated receipt, Authority, complete Teaching Projection, domain fragments, prerequisites, resources, shards, and consumer activation reopen with matching identities
- **THEN** the workspace SHALL display the published Teaching families by default from that exact combination
- **AND** it SHALL expose no relation from the predecessor, legacy graph, or a mismatched projection
