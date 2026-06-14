## Purpose

Define the ResourceNode-aware knowledge workspace UI contract that connects graph exploration, resource details, mapping warnings, role-scoped diagnostics, and launch actions without moving resource implementations into the knowledge UI.
## Requirements
### Requirement: Knowledge workspace supports ResourceNode-aware exploration
The system SHALL provide a knowledge/resource workspace that can display graph nodes and mapped ResourceNodes through shared workspace UI.

#### Scenario: ResourceNode mapping exists
- **WHEN** a selected knowledge node or resource has a ResourceNode mapping
- **THEN** the UI SHALL show source reference, knowledge coverage, prerequisites, availability, privacy level, teacher policy, evidence instrumentation, and path eligibility where role scope permits.

### Requirement: Partial ResourceNode coverage is explicit
The system SHALL make missing or partial ResourceNode coverage visible.

#### Scenario: Resource lacks a required mapping
- **WHEN** a resource lacks render target, launch target, knowledge mapping, availability, privacy policy, or evidence instrumentation
- **THEN** the workspace SHALL show a warning or unavailable state with a reason suitable for the current role.

### Requirement: Resource launch actions preserve source ownership
The system SHALL launch mapped resources through their existing source-of-record, registry, or feature-owned launcher contracts.

#### Scenario: User launches a mapped resource
- **WHEN** a user launches a lesson, media item, widget, simulation, Arena task, or adaptive path node from the knowledge/resource workspace
- **THEN** the UI SHALL use the ResourceNode source reference, `registryId`, route, or feature-owned launcher contract where available
- **AND** it SHALL NOT move resource implementations, lesson rendering, or Arena/simulation business logic into the knowledge workspace UI.

### Requirement: Workspace preserves current graph exploration
The system SHALL keep existing knowledge graph browsing available while ResourceNode-aware panels are introduced.

#### Scenario: ResourceNode feature flag is disabled
- **WHEN** ResourceNode-aware UI is disabled
- **THEN** the knowledge graph SHALL remain usable through the existing exploration and resource-panel behavior.

### Requirement: Graph relationship lines encode relation meaning
The knowledge graph SHALL render relation lines with distinct visual semantics for prerequisite/foundation, contains, follows/leads-to, applies-to, opposite, and related relations.

#### Scenario: Graph renders multiple relation types
- **WHEN** the graph displays different relation types
- **THEN** each type SHALL use an approved combination of color role, line style, width, arrow behavior, opacity, and legend label
- **AND** relation meaning SHALL remain distinguishable in both light and dark themes without relying on color alone.

### Requirement: Default graph view limits edge density
The knowledge graph SHALL limit default visible edges to high-signal structure and current exploration context.

#### Scenario: Graph opens with many available relations
- **WHEN** the available relation count is high
- **THEN** the default view SHALL show skeleton, hierarchy, prerequisite, follows/leads-to, and selected-context relations before weak related edges
- **AND** weaker relations SHALL be dimmed, collapsed, or hidden until selected through filters or focus interaction.

### Requirement: Graph focus reduces unrelated edge noise
The knowledge graph SHALL dim unrelated edges and emphasize selected-node neighborhoods during hover, selection, or search focus.

#### Scenario: User selects a node
- **WHEN** a node is selected or focused
- **THEN** directly relevant nodes and relations SHALL become visually prominent
- **AND** unrelated edges SHALL reduce opacity enough to make the selected neighborhood readable while preserving orientation.

### Requirement: Relation legend and filters are part of the workspace
The knowledge graph SHALL expose relation legend and filters as workspace controls aligned with the shared shell and floating action dock.

#### Scenario: User changes relation filters
- **WHEN** a user toggles relation families, density, or weak-edge visibility
- **THEN** the graph SHALL update without losing selected node context, panel state, or ResourceNode-aware launch actions
- **AND** controls SHALL not overlap the shared floating action dock.

### Requirement: Knowledge workspace is canvas-first on mobile
The ResourceNode knowledge workspace SHALL prioritize the graph/canvas on mobile.

#### Scenario: Knowledge graph renders at 320px width
- **WHEN** `/knowledge` opens on mobile
- **THEN** the graph or canvas area SHALL be visible as the primary surface
- **AND** chapter directory, relation filters, legends, and resource panels SHALL open through drawers, sheets, or focused panels rather than permanent side-by-side columns.

### Requirement: Knowledge controls do not block launch or dock actions
The ResourceNode workspace SHALL coordinate filters, legends, node panels, launch actions, and floating dock placement.

#### Scenario: Filters or node panels are open
- **WHEN** a user opens relation filters, chapter filters, legend, or ResourceNode panel
- **THEN** primary launch, close, return, and dock controls SHALL remain reachable and non-overlapping.

### Requirement: Knowledge workspace launches real learning resources
The ResourceNode knowledge workspace SHALL connect graph exploration to actual learning resources and evidence review.

#### Scenario: Knowledge node with launchable resource is selected
- **WHEN** a selected node has a registered ResourceNode, course resource, simulation, lesson entry, or evidence target
- **THEN** the UI SHALL expose the launch action and return path
- **AND** the knowledge graph SHALL NOT be accepted as a decorative graph with no connection to learning paths, resources, or evidence.

### Requirement: Knowledge graph tools are collapsible local tools
The knowledge workspace SHALL expose chapter directory, relation filters, legend, view switch, and resource panel as collapsible or drawer-based local tools.

#### Scenario: Desktop knowledge graph opens
- **WHEN** `/knowledge` renders on a desktop viewport
- **THEN** the graph SHALL expose relation filters and chapter directory through local tool panels with visible open and closed states
- **AND** the graph canvas SHALL remain usable when those tools are closed.

#### Scenario: Mobile knowledge graph opens
- **WHEN** `/knowledge` renders at mobile width
- **THEN** chapter directory, relation filters, legend, view switch, and resource details SHALL open through a drawer, sheet, or focused tool panel
- **AND** scattered permanent controls SHALL NOT block the graph canvas or floating dock.

### Requirement: Knowledge graph panels use platform token roles
Knowledge graph local panels SHALL use platform semantic token roles instead of page-local Tailwind color families or unregistered accent palettes.

#### Scenario: Resource panel displays node metadata
- **WHEN** the knowledge resource panel renders node type, Bloom level, knowledge dimension, chapter, difficulty, importance, source quality, or launch state
- **THEN** badge, border, background, and text colors SHALL use approved platform token roles
- **AND** local `slate`, `sky`, `cyan`, `amber`, `emerald`, `fuchsia`, or raw hex palettes SHALL NOT be introduced on migrated lines.

### Requirement: Active knowledge filters remain visible when collapsed
The knowledge workspace SHALL preserve filter state visibility when local tools are collapsed.

#### Scenario: User collapses relation filters
- **WHEN** a user has active relation types, chapter filters, density mode, strength threshold, or connected-node filters and closes the filter panel
- **THEN** the closed tool affordance SHALL summarize active filter state
- **AND** reopening the tool SHALL preserve selected node, visible graph state, and resource panel context.

### Requirement: Knowledge graph relation styles use semantic visual grammar
The knowledge graph SHALL render each supported relation family with a distinct visual grammar that does not rely on color alone.

#### Scenario: Multiple relation types render together
- **WHEN** prerequisite, contains, follows/leads-to, applies-to, opposite, and related relations are visible in the graph
- **THEN** each relation family SHALL use a distinct combination of fine line pattern, arrow behavior, endpoint treatment, curvature or opacity
- **AND** the visual difference SHALL remain distinguishable in both light and dark themes.

#### Scenario: Dense graph renders by default
- **WHEN** the graph opens with many available relations
- **THEN** relation edges SHALL render as fine lines by default
- **AND** emphasis SHALL come from hover, focus, selection, or filter state rather than permanently thick strokes.

### Requirement: Runtime relation types have complete visual-semantic coverage
The knowledge graph SHALL map every relation type present in the runtime knowledge graph to explicit teaching semantics before rendering.

#### Scenario: Runtime graph relation types are loaded
- **WHEN** relation types are read from `course-content/runtime/knowledge/graph/relations.jsonl`
- **THEN** every distinct relation type SHALL have a Chinese teaching label, visual family, direction semantics, default density policy, and graphical legend explanation
- **AND** unknown relation types SHALL NOT silently fall back to the generic `related` visual family.

#### Scenario: Specialized relation types exist
- **WHEN** relation types such as `cross_domain`, `generalizes`, `instance_of`, `supports`, `enables`, `opposite`, or `related` exist in runtime data
- **THEN** each type SHALL remain distinguishable through its mapped teaching label, filter option, visual family, and graph legend
- **AND** the mapping SHALL preserve the intended teaching logic instead of flattening specialized relations into weak association.

### Requirement: Knowledge graph node scale reflects instructional and graph importance
The knowledge graph SHALL scale node size from bounded importance signals rather than rendering all nodes at the same size.

#### Scenario: Nodes have different importance or connection counts
- **WHEN** nodes include importance metadata, degree centrality, or selected-neighborhood relevance
- **THEN** node radius SHALL prioritize explicit teaching importance or course-core metadata before degree centrality
- **AND** degree or connection count SHALL act only as a capped secondary signal within a bounded range that preserves labels and neighboring nodes
- **AND** selected or focused nodes SHALL remain visually prominent without hiding nearby nodes.

### Requirement: Relation legend is graphical
The knowledge workspace SHALL show relationship legend items as visual samples generated from the same relation style contract used by the graph.

#### Scenario: User reads the relation legend
- **WHEN** the legend is visible
- **THEN** each legend item SHALL include a miniature graphical edge sample matching the actual edge style
- **AND** the legend SHALL NOT rely on text-only descriptions such as "long dashed arrow" as the only explanation.

### Requirement: Knowledge graph communicates a learner-readable concept map
The knowledge graph SHALL make the main conceptual structure understandable from the default view before learners open dense tools or all-relation modes.

#### Scenario: Learner opens the default graph view
- **WHEN** a learner first opens the knowledge graph
- **THEN** the learner SHALL be able to distinguish prerequisite/foundation, contains, and follows/leads-to relation families through visible edge grammar and legend samples
- **AND** weak related edges SHALL NOT form the primary visual skeleton of the graph.

### Requirement: Knowledge graph visible labels use Chinese teaching language
The knowledge workspace SHALL localize visible graph filter, legend, and metadata labels into Chinese learner-facing language.

#### Scenario: User opens graph filters
- **WHEN** category, Bloom level, relation type, density, strength, or connected-node filters are shown
- **THEN** the labels SHALL use Chinese teaching terms
- **AND** raw field names such as `category`, `bloom_level`, or implementation enum keys SHALL NOT appear as primary visible labels.

### Requirement: Knowledge graph default view prioritizes readable structure
The knowledge graph SHALL open in a high-signal view that exposes conceptual structure before weak relationship density.

#### Scenario: Graph opens with many relations
- **WHEN** the graph has more relations than can be read at the current viewport
- **THEN** the default view SHALL prioritize skeleton, hierarchy, prerequisite/foundation, contains, follows/leads-to, and selected-context relations
- **AND** weak related edges SHALL be hidden, faded, or deferred until the user selects a denser mode.

### Requirement: Knowledge graph focus reveals logical neighborhoods
The knowledge graph SHALL make selected-node neighborhoods readable by reducing unrelated graph noise.

#### Scenario: User selects a node
- **WHEN** a node is selected
- **THEN** directly relevant nodes and relations SHALL become visually prominent
- **AND** unrelated nodes and relations SHALL reduce opacity or visibility enough that the selected neighborhood remains readable.

### Requirement: Knowledge graph layout has measurable clarity bounds
The knowledge graph SHALL expose testable clarity behavior for node size, visible edge density, label visibility, and overlap.

#### Scenario: Layout clarity is validated
- **WHEN** automated or manual visual QA checks a representative graph state
- **THEN** the check SHALL verify bounded node size, bounded visible edge density, recoverable label visibility, and selected-neighborhood readability
- **AND** accepting a graph as migrated SHALL NOT rely only on the presence of graph DOM nodes.

### Requirement: Dense relation modes remain user controlled
The knowledge graph SHALL allow learners to request denser relation views without making dense views the default.

#### Scenario: User requests all relations
- **WHEN** the user selects an all-relations or equivalent density mode
- **THEN** the graph MAY show weak and non-structural edges
- **AND** the UI SHALL make the dense mode explicit and reversible without losing selected node context.

#### Scenario: User returns from dense mode
- **WHEN** the user returns from all-relations mode to the default or focused mode
- **THEN** the graph SHALL restore the appropriate high-signal relation set
- **AND** selected node, active filters, density mode state, and visible summaries SHALL remain consistent.

### Requirement: Knowledge graph local tools open from compact default controls
The knowledge workspace SHALL expose chapter directory, relation filters, relation legend, view switch, and resource panel as compact default controls rather than permanent desktop panels.

#### Scenario: Desktop knowledge graph first renders
- **WHEN** `/knowledge` first renders on a desktop viewport
- **THEN** the chapter directory, relation filters, relation legend, view switch, and resource panel SHALL be collapsed or compacted into discoverable local tool controls unless a selected-node resource panel is explicitly opened by the user
- **AND** the graph canvas SHALL receive the primary visible area by default.

#### Scenario: User opens graph tools
- **WHEN** the user opens chapter directory, relation filters, legend, or view controls
- **THEN** the opened control SHALL preserve graph context, selected node state, active filters, density mode, legend mode, and visible summaries
- **AND** closing the control SHALL restore the compact canvas-first layout.

#### Scenario: Graph renders at tablet width
- **WHEN** `/knowledge` renders at an intermediate viewport between mobile and desktop breakpoints
- **THEN** local tools SHALL use the same compact or drawer-based behavior as the nearest safe canvas-first layout
- **AND** the layout SHALL NOT create a third state where permanent panels squeeze the graph canvas.

### Requirement: Knowledge graph interactions preserve layout stability
The knowledge graph SHALL keep layout state stable when users hover, select, or inspect nodes.

#### Scenario: User hovers over a node
- **WHEN** the pointer hovers over a graph node
- **THEN** the graph MAY show a lightweight name preview and local visual emphasis
- **AND** hover SHALL NOT rebuild filtered graph data, change relation density, rerun layout, reheat the force simulation, or trigger automatic camera movement.

#### Scenario: User moves across many nodes quickly
- **WHEN** pointer movement emits many hover events across graph nodes
- **THEN** hover preview updates SHALL be throttled, debounced, or renderer-local enough to avoid visible jitter
- **AND** high-frequency hover SHALL NOT change layout version, filtered graph membership, or assistant durable context.

#### Scenario: User selects a node
- **WHEN** the user clicks or otherwise selects a graph node
- **THEN** the graph SHALL update selected styling and inspector context
- **AND** selection SHALL NOT recreate graph node objects, rerun radial or force layout, reset user-positioned nodes, or call fit-to-view without an explicit user action.

#### Scenario: User opens or closes the node inspector
- **WHEN** the selected-node inspector opens, closes, or updates content for another node
- **THEN** graph layout coordinates SHALL remain stable
- **AND** the inspector transition SHALL NOT redistribute unrelated graph nodes.

### Requirement: Knowledge graph drag state is explicit and recoverable
The knowledge graph SHALL preserve user-dragged node positions until the user or a real graph data change requests a new layout.

#### Scenario: User drags a node
- **WHEN** the user drags a node and releases it
- **THEN** the final coordinates SHALL be stored by node id as user-positioned or pinned layout state
- **AND** subsequent hover, selection, and inspector updates SHALL preserve those coordinates.

#### Scenario: User requests layout reset
- **WHEN** the user activates an explicit relayout, reset, or clear-pins command
- **THEN** the graph MAY recompute layout
- **AND** the UI SHALL make the change intentional rather than treating it as a side effect of normal inspection.

#### Scenario: Filters change the visible graph
- **WHEN** relation filters, chapter filters, or density mode changes hide or show graph nodes
- **THEN** visible user-positioned nodes SHALL retain their stored coordinates where possible
- **AND** the layout system SHALL not erase pinned positions unless the node is no longer part of the current graph data or the user resets layout.

