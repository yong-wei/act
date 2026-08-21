## ADDED Requirements

### Requirement: Active Authority uses the stable overlay inspector
Selecting a node in the new graph SHALL open or update the established stable knowledge inspector as a desktop overlay or mobile focus-contained drawer. Inspector lifecycle MUST NOT resize the graph layout column, recompute established coordinates, reset pan or zoom, clear relation filters, or remount unrelated graph state.

#### Scenario: Desktop user selects a node
- **WHEN** a desktop user activates an active Authority node
- **THEN** a floating inspector SHALL appear over the workspace using predictable insets without reducing the graph's layout width
- **AND** the selected node, visible relations, coordinates, pan, and zoom SHALL remain stable

#### Scenario: Mobile user closes node detail
- **WHEN** a mobile user closes the selected-node drawer with its control or Escape
- **THEN** focus SHALL return to the invoking node or graph canvas
- **AND** the active domain, filters, cached shards, and viewport state SHALL remain available

### Requirement: Active inspector presents registered resources through existing launchers
The active Authority inspector SHALL present authorized registered resources after semantic identity and governed knowledge content, grouped by their typed teaching role. Each actionable item SHALL use the server-projected source-owned launch descriptor and MUST NOT embed an arbitrary resource runtime inside the inspector.

#### Scenario: Node has several resource roles
- **WHEN** a selected node has role-authorized bindings classified as `讲解`, `练习`, `评价`, or `引用`
- **THEN** the inspector SHALL group and label those resources by role and expose their existing platform launch actions
- **AND** resource order or launchability SHALL not alter Authority relations or teaching projection

#### Scenario: Node has no launchable resource
- **WHEN** the selected node has no authorized launch descriptor
- **THEN** semantic detail, Knowledge Card content, and published relations SHALL remain usable
- **AND** the inspector SHALL show an honest scoped empty state instead of inventing a resource route

### Requirement: Active inspector relation neighbors support continued exploration
Every presented one-hop teaching or engineering relation summary SHALL preserve its exact layer, meaning, direction, and neighboring semantic identity. Activating an eligible neighbor SHALL use the existing bounded neighborhood or cross-domain navigation path and SHALL not close the inspector merely to indicate loading.

#### Scenario: User activates an in-domain relation neighbor
- **WHEN** the user selects a neighbor listed in the inspector
- **THEN** the graph SHALL materialize and select that real node through the active shard contract
- **AND** the inspector SHALL update without resetting the domain canvas

#### Scenario: User activates a cross-domain relation neighbor
- **WHEN** the relation endpoint belongs to another reviewed domain
- **THEN** the workspace SHALL enter the owning domain before selecting the endpoint
- **AND** it SHALL retain the exact published relation meaning during navigation

### Requirement: Inspector knowledge content renders governed LaTeX
Formula expressions and declared Knowledge Card mathematical nodes in the active inspector SHALL use the existing LaTeX/KaTeX renderer. A content block that cannot be rendered safely SHALL fail closed at that block while leaving semantic detail, relations, and resource actions available.

#### Scenario: Knowledge Card contains inline and block math
- **WHEN** an eligible Knowledge Card contains governed mathematical nodes
- **THEN** inline and block expressions SHALL render with the platform mathematics components
- **AND** raw TeX commands SHALL not be the primary learner-visible representation
