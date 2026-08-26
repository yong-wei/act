## Purpose

Define the ResourceNode-aware knowledge workspace UI contract that connects graph exploration, resource details, mapping warnings, role-scoped diagnostics, and launch actions without moving resource implementations into the knowledge UI.
## Requirements
### Requirement: Knowledge workspace supports ResourceNode-aware exploration
The system SHALL preserve ordinary ResourceNode detail and resource exploration without exposing persisted path eligibility in the knowledge graph workspace.

The workspace MUST distinguish Engineering Authority nodes/relations from ACT teaching prerequisites and teaching resource bindings. Resource links, scope, projection identity, and fallback status SHALL be shown as separate evidence groups.

#### Scenario: ResourceNode mapping exists
- **WHEN** a selected knowledge node or resource has a ResourceNode mapping
- **THEN** the UI SHALL show source reference, knowledge coverage, prerequisites, availability, privacy level, teacher policy, and evidence instrumentation where role scope permits
- **AND** `/knowledge` SHALL NOT display ResourceNode path eligibility or use it to derive layout, corridor, animation, or inspector state.

#### Scenario: Node has teaching resources
- **WHEN** a selected Canonical node has scoped bindings
- **THEN** the inspector SHALL show course/handout/step/textbook/card resources with role and projection provenance
- **AND** engineering relation details SHALL remain exact and separate

#### Scenario: Node is not projected to a course
- **WHEN** a valid Authority node has no binding in the current course scope
- **THEN** the workspace SHALL show `NOT_PROJECTED` for that scope
- **AND** it SHALL not imply an upstream graph defect

### Requirement: Partial ResourceNode coverage is explicit
The system SHALL make missing or partial ResourceNode coverage visible.

Missing teaching resources or cards MUST be represented as scoped status, not as missing Canonical nodes. The workspace MAY use a Legacy/pinned fallback only when the status identifies the fallback identity.

#### Scenario: Resource lacks a required mapping
- **WHEN** a resource lacks render target, launch target, knowledge mapping, availability, privacy policy, or evidence instrumentation
- **THEN** the workspace SHALL show a warning or unavailable state with a reason suitable for the current role.

#### Scenario: Optional card is absent
- **WHEN** a step Canonical ref has no active optional card
- **THEN** the drawer SHALL show the node summary or other linked resources
- **AND** it SHALL not display a node-not-found error

### Requirement: Resource launch actions preserve source ownership
The system SHALL launch mapped resources through existing source-owned launcher contracts without treating launchability as graph path projection.

#### Scenario: User launches a mapped resource
- **WHEN** a user launches a lesson, media item, widget, simulation, Arena task, or adaptive path node from the knowledge/resource workspace
- **THEN** the UI SHALL use the ResourceNode source reference, `registryId`, route, or feature-owned launcher contract where available
- **AND** an adaptive path node launch SHALL remain an opaque feature-owned action and SHALL NOT expose, map, or animate its persisted path in the graph
- **AND** the knowledge workspace SHALL NOT absorb resource, lesson, Arena, simulation, or adaptive-path business logic.

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
The knowledge graph SHALL limit default visible edges to the active domain's post-requisite and association presentation families and current exploration context.

#### Scenario: Root view opens
- **WHEN** the compact root domain chooser is visible
- **THEN** domain selection SHALL remain readable without displaying child membership rays or raw-semantic edge density
- **AND** root summaries MAY communicate domain size without materializing member relations.

#### Scenario: Domain view opens with many relations
- **WHEN** the active domain contains more relations than can be read at the current viewport
- **THEN** post-requisite edges SHALL form the primary learning-order skeleton, association edges SHALL remain visually subordinate, and child edges SHALL remain hidden by default
- **AND** selected-corridor focus and explicit family controls SHALL govern additional emphasis.

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
The ResourceNode knowledge workspace SHALL connect graph exploration to actual learning resources and evidence review while keeping canonical graph corridors separate from persisted personalized paths.

Course/resource actions MUST carry the active course scope and projection identity to the existing resource route, and a fallback action MUST preserve its explicit Legacy/pinned provenance.

#### Scenario: Knowledge node with launchable resource is selected
- **WHEN** a selected node has a registered ResourceNode, course resource, simulation, lesson entry, or evidence target
- **THEN** the UI SHALL expose the source-owned launch action and return path
- **AND** the canonical corridor MAY explain authored prerequisite order but SHALL NOT inspect or project a persisted LearningPath.

#### Scenario: Resource action opens
- **WHEN** a learner opens a projected handout or interactive step
- **THEN** the target SHALL resolve through the existing course/resource registry
- **AND** the action SHALL not invent a route from an ActKG node ID

### Requirement: Knowledge graph tools are collapsible local tools
The knowledge workspace SHALL expose chapter directory, node metadata filters, view and layout controls, and resource inspector as collapsible local tools while relation-family visibility remains in the compact canvas legend.

#### Scenario: Desktop knowledge graph opens
- **WHEN** `/knowledge` renders on a desktop viewport
- **THEN** directory, node metadata, view, and layout controls SHALL use compact local panels with visible open and closed states
- **AND** raw relation-type, density, strength, connected-node, and full semantic legend panels SHALL not remain as learner-facing tools
- **AND** the graph canvas SHALL remain usable when local tools are closed.

#### Scenario: Mobile knowledge graph opens
- **WHEN** `/knowledge` renders at mobile width
- **THEN** directory, node metadata, view, layout, and resource details SHALL open through a drawer, sheet, or focused panel
- **AND** relation-family visibility SHALL remain reachable through the synchronized compact legend without blocking the canvas or floating dock.

### Requirement: Knowledge graph panels use platform token roles
Knowledge graph local panels SHALL use platform semantic token roles instead of page-local Tailwind color families or unregistered accent palettes.

#### Scenario: Resource panel displays node metadata
- **WHEN** the knowledge resource panel renders node type, Bloom level, knowledge dimension, chapter, difficulty, importance, source quality, or launch state
- **THEN** badge, border, background, and text colors SHALL use approved platform token roles
- **AND** local `slate`, `sky`, `cyan`, `amber`, `emerald`, `fuchsia`, or raw hex palettes SHALL NOT be introduced on migrated lines.

### Requirement: Active knowledge filters remain visible when collapsed
The knowledge workspace SHALL preserve node-filter and relation-family state visibility when local tools are collapsed.

#### Scenario: User collapses node filters
- **WHEN** chapter, category, Bloom level, search, or other retained node filters are active and the node-filter panel closes
- **THEN** the closed affordance SHALL summarize those retained filters
- **AND** reopening it SHALL preserve current domain, selected node, family visibility, viewport, and inspector context.

#### Scenario: Relation-family visibility changes
- **WHEN** child, post-requisite, or association eligibility changes
- **THEN** the compact legend itself SHALL expose current checked or mixed state
- **AND** no separate raw-type/density/strength summary SHALL be required.

### Requirement: Knowledge graph relation styles use semantic visual grammar
The knowledge graph SHALL render child, post-requisite, and association presentation families with distinct visual grammar that does not rely on color alone. Within each family's grammar, edge evidence state SHALL be encoded as a bounded modulation of opacity and width: edges whose public link carries `evidenceState: 'unavailable'` SHALL render muted relative to evidence-available edges of the same family, while edges whose evidence state is absent SHALL render exactly as before this modulation existed.

#### Scenario: Three relation families render together
- **WHEN** child, post-requisite, and association edges are enabled
- **THEN** each family SHALL use a distinct combination of line pattern, target-arrow behavior, opacity, and curvature
- **AND** raw relation distinctions SHALL remain available in the inspector rather than multiplying canvas grammars.

#### Scenario: Dense domain renders by default
- **WHEN** the active domain has many available relations
- **THEN** relation edges SHALL remain fine and association edges subordinate
- **AND** emphasis SHALL come from selection, corridor focus, or family visibility rather than permanently thick strokes.

#### Scenario: Unavailable-evidence edge renders muted within its family
- **WHEN** an enabled edge's public link carries `evidenceState: 'unavailable'`
- **THEN** the edge SHALL render with reduced opacity and reduced width relative to an evidence-available edge of the same family and theme
- **AND** it SHALL keep its family's line pattern, arrow behavior, and curvature
- **AND** the muted variant SHALL remain distinguishable from the family's available variant in both light and dark themes without relying on color alone.

#### Scenario: Unknown evidence state preserves prior rendering
- **WHEN** an enabled edge's public link omits `evidenceState`
- **THEN** the edge SHALL render with the same opacity, width, pattern, and arrow behavior it had before evidence modulation existed.

#### Scenario: Evidence modulation respects density budgets
- **WHEN** evidence modulation is applied in a dense domain
- **THEN** default visible edge counts per family, the post-requisite structural foreground cap, and the association one-hop cap SHALL be unchanged
- **AND** muted edges SHALL NOT be hidden or reordered solely because of their evidence state.

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
The knowledge graph SHALL scale node size from bounded importance signals rather than rendering all nodes at the same size. When a node carries `sourceCoverageCount`, that count SHALL act only as a capped tertiary signal after teaching importance and degree centrality, and its absence SHALL never reduce a node below the size it would have had without coverage data.

#### Scenario: Nodes have different importance or connection counts
- **WHEN** nodes include importance metadata, degree centrality, or selected-neighborhood relevance
- **THEN** node radius SHALL prioritize explicit teaching importance or course-core metadata before degree centrality
- **AND** degree or connection count SHALL act only as a capped secondary signal within a bounded range that preserves labels and neighboring nodes
- **AND** selected or focused nodes SHALL remain visually prominent without hiding nearby nodes.

#### Scenario: Coverage count modulates within a cap
- **WHEN** two nodes share the same importance and degree signals but differ in `sourceCoverageCount`
- **THEN** the higher-coverage node MAY render larger within the bounded tertiary range
- **AND** neither node SHALL exceed the existing size bounds that preserve labels and neighbors.

#### Scenario: Absent coverage never penalizes
- **WHEN** a node omits `sourceCoverageCount`
- **THEN** its radius SHALL equal the radius it would have had from importance and degree signals alone.

### Requirement: Relation legend is graphical
The knowledge workspace SHALL show child, post-requisite, and association legend controls as graphical samples generated from the same presentation-family contract used by the graph.

#### Scenario: User reads the compact relation legend
- **WHEN** the compact legend is visible
- **THEN** `子级`, `后置`, and `关联` SHALL each include a miniature sample matching the active renderer
- **AND** the legend SHALL not enumerate every raw runtime relation type.

#### Scenario: User operates the all-families control
- **WHEN** the user activates `全部` from a partial family selection
- **THEN** all three families SHALL become enabled
- **AND** activating it while all three are enabled SHALL restore the default post-requisite-plus-association set
- **AND** checked, unchecked, and mixed state SHALL be exposed to keyboard and assistive technology and synchronized across desktop and mobile controls.

### Requirement: Knowledge graph communicates a learner-readable concept map
The knowledge graph SHALL make domain choice and prerequisite learning order understandable before learners inspect raw relation detail.

#### Scenario: Learner opens the root graph view
- **WHEN** a learner first opens the knowledge graph
- **THEN** compact large domain nodes SHALL provide the primary conceptual overview without child rays or an all-semantic legend
- **AND** activating one domain SHALL reveal only that domain's knowledge map.

#### Scenario: Learner reads a domain graph
- **WHEN** a single-domain view is active
- **THEN** post-requisite direction and selected canonical corridors SHALL be visually primary, association SHALL be secondary, and child membership SHALL remain available on request
- **AND** every visible line SHALL correspond to canonical relation provenance.

### Requirement: Knowledge graph visible labels use Chinese teaching language
The knowledge workspace SHALL use Chinese learner-facing language for node metadata, retained node filters, three relation families, inspector sentences, cycle/gap states, and navigation.

#### Scenario: User opens retained node filters
- **WHEN** chapter, category, Bloom level, search, or another retained node filter is shown
- **THEN** labels SHALL use Chinese teaching terms
- **AND** raw keys such as `category`, `bloom_level`, or implementation enum values SHALL not appear as primary labels.

#### Scenario: User reads relation presentation
- **WHEN** the compact legend or inspector presents graph relations
- **THEN** the canvas SHALL use `子级`, `后置`, and `关联` and the inspector SHALL use reviewed source/target Chinese sentences
- **AND** removed raw relation-type, density, strength, and connected-node filter labels SHALL not remain as learner controls.

### Requirement: Knowledge graph default view prioritizes readable structure
The knowledge graph SHALL open in a compact root view and then prioritize post-requisite learning order inside one active domain.

#### Scenario: Root view contains many domains
- **WHEN** domain roots exceed a single compact row
- **THEN** deterministic collision-safe packing SHALL preserve readable labels without expanding into a distant complete ring.

#### Scenario: Active domain contains many relations
- **WHEN** the domain has more relations than can be read at once
- **THEN** the default family set SHALL include post-requisite and association but exclude child
- **AND** association opacity and selected-corridor focus SHALL prevent weak relations from becoming the primary skeleton.

### Requirement: Knowledge graph focus reveals logical neighborhoods
The knowledge graph SHALL make selected-node neighborhoods readable by reducing unrelated graph noise.

#### Scenario: User selects a node
- **WHEN** a node is selected
- **THEN** directly relevant nodes and relations SHALL become visually prominent
- **AND** unrelated nodes and relations SHALL reduce opacity or visibility enough that the selected neighborhood remains readable.

### Requirement: Knowledge graph layout has measurable clarity bounds
The knowledge graph SHALL enforce quantitative clarity and motion bounds on representative reviewed domain data.

#### Scenario: Representative domain layout is validated
- **WHEN** a checked-in fixture generated from the largest reviewed runtime domain and carrying its graph-version hash is captured in Chromium at 1440×900 CSS pixels and device scale factor 1 after a two-second warm-up and initial fit
- **THEN** visible node bodies SHALL have zero overlaps and overlapping visible-label pairs SHALL not exceed five percent
- **AND** label overlap ratio SHALL equal unique intersecting visible-label pairs divided by visible rendered label count
- **AND** lower-priority labels SHALL defer rather than violate the label-overlap bound.

#### Scenario: Focus motion performance is validated
- **WHEN** a selected corridor is animated without CPU throttling for ten seconds after warm-up on the reference visual-QA desktop
- **THEN** it SHALL contain no more than 64 nodes, 96 edges, four ancestor levels, four descendant levels, and three simultaneous motion markers
- **AND** 95th-percentile `requestAnimationFrame` interval SHALL remain below 24 milliseconds with no graph-attributable PerformanceObserver long task above 100 milliseconds
- **AND** evidence SHALL record browser version, fixture hash, hardware identifier, raw samples, and formulas.

### Requirement: Knowledge graph local tools open from compact default controls
The knowledge workspace SHALL expose directory, retained node filters, view, layout, and resource inspector through compact default controls while keeping the three-family legend directly available on the canvas.

#### Scenario: Desktop knowledge graph first renders
- **WHEN** `/knowledge` first renders on a desktop viewport
- **THEN** retained local tools SHALL be collapsed or compacted unless the user explicitly opens an inspector
- **AND** the compact domain chooser or active domain canvas and three-family legend SHALL receive the primary visible area.

#### Scenario: User opens a retained graph tool
- **WHEN** the user opens directory, node filters, view, or layout controls
- **THEN** the tool SHALL preserve navigation state, selected node, family visibility, viewport, and inspector context
- **AND** closing it SHALL restore the compact canvas-first layout.

#### Scenario: Graph renders at tablet width
- **WHEN** `/knowledge` renders between mobile and desktop breakpoints
- **THEN** retained local tools SHALL use the nearest safe compact or drawer behavior
- **AND** no permanent panel SHALL squeeze the graph canvas.

### Requirement: Knowledge graph interactions preserve layout stability
The knowledge graph SHALL keep layout state stable when users hover, enter or leave domains, select, inspect, filter, drag, or dismiss nodes.

#### Scenario: User hovers over a node
- **WHEN** the pointer hovers over a graph node
- **THEN** the graph MAY show a lightweight name preview and local visual emphasis
- **AND** hover SHALL NOT rebuild graph membership, change relation families, rerun layout, reheat force simulation, or move the camera.

#### Scenario: User moves across many nodes quickly
- **WHEN** pointer movement emits many hover events
- **THEN** preview updates SHALL be throttled, debounced, or renderer-local enough to avoid visible jitter
- **AND** high-frequency hover SHALL NOT change domain, layout version, visible membership, or assistant durable context.

#### Scenario: User activates a domain or knowledge node
- **WHEN** the user clicks, taps, or keyboard-activates a graph node
- **THEN** a domain root SHALL enter its single-domain view and a knowledge node SHALL select, focus, and inspect
- **AND** activation SHALL not recreate unrelated graph objects, rerun global radial layout, reset user-positioned nodes, or call full fit-to-view.

#### Scenario: User opens or closes the node inspector
- **WHEN** the inspector opens, closes, updates, or is dismissed by blank-space activation or manipulation start
- **THEN** current domain coordinates, viewport scale, family selection, focused corridor, and loaded shard state SHALL remain stable
- **AND** the transition SHALL not redistribute unrelated nodes.

### Requirement: Knowledge graph drag state is explicit and recoverable
The knowledge graph SHALL freeze established coordinates after each explicit root or domain layout and preserve user-positioned nodes until the user, graph version, or domain navigation requests a new layout.

#### Scenario: Automatic root or domain layout completes
- **WHEN** bounded compact-root or domain layout finishes
- **THEN** visible coordinates SHALL become stable for that navigation state
- **AND** ordinary hover, selection, family toggles, inspector updates, or association-neighborhood changes SHALL not reheat a free-running force simulation.

#### Scenario: User starts dragging a node
- **WHEN** node drag begins
- **THEN** the inspector SHALL close and every other visible node SHALL retain its coordinate
- **AND** the active domain and focused corridor SHALL remain selected.

#### Scenario: User releases a dragged node
- **WHEN** the dragged node is released
- **THEN** only that node's final coordinate SHALL be stored as user-positioned
- **AND** no unrelated coordinate SHALL be overwritten.

#### Scenario: User requests layout reset
- **WHEN** the user explicitly requests relayout, reset, or clear positions
- **THEN** the active navigation state's layout MAY recompute
- **AND** the change SHALL not occur as a side effect of ordinary inspection.

#### Scenario: Retained filters or family visibility change
- **WHEN** node filters or child/post-requisite/association eligibility hide or show content
- **THEN** visible user-positioned and established nodes SHALL retain stored coordinates where possible
- **AND** removed density-mode behavior SHALL not erase positions or become a hidden relayout trigger.

### Requirement: Knowledge graph renders as a semantic map
The knowledge graph SHALL present compact domains, ordered nodes, edges, labels, and selected corridors as a readable semantic map rather than an all-edge tangle.

#### Scenario: Root semantic map renders
- **WHEN** `/knowledge` opens
- **THEN** compact domain nodes and summaries SHALL establish the top-level map without member rays or global dense relations.

#### Scenario: Domain semantic map renders
- **WHEN** one domain is active
- **THEN** teaching-order placement and post-requisite edges SHALL form the primary structure, association SHALL be absent before selection and bounded afterward, and child SHALL remain optional
- **AND** learners SHALL not need a dense all-relations mode to understand the map.

#### Scenario: Selected corridor renders
- **WHEN** a knowledge node is selected and its corridor is immediately derived from authored canonical post-requisite edges
- **THEN** directly relevant nodes and canonical post-requisite relations SHALL receive bounded emphasis
- **AND** unrelated content SHALL dim without changing domain membership.

#### Scenario: Compact legend renders
- **WHEN** relation-family controls are visible
- **THEN** samples SHALL come from the same renderer contract and remain accurate in light and dark themes
- **AND** no standalone full semantic legend SHALL be required.

### Requirement: Knowledge graph presentation follows approved concept direction
Knowledge graph presentation SHALL adopt the approved Product Design direction without copying generated mockup chrome.

#### Scenario: Concept direction is applied
- **WHEN** the graph visual presentation is implemented
- **THEN** it SHALL adopt layered semantic organization, premium dark depth, and clear light-mode readability from the approved concept references
- **AND** it SHALL NOT copy standalone shell chrome, role switchers, exact generated node positions, or generated labels as product truth.

### Requirement: Knowledge graph local tools use a compact command system
The knowledge workspace SHALL expose graph-specific directory, retained node filters, view, layout, focus, and return navigation through a coherent compact command system and SHALL keep relation-family visibility in the compact legend.

#### Scenario: Desktop knowledge graph opens
- **WHEN** `/knowledge` renders on desktop
- **THEN** retained tools SHALL appear as compact workspace commands and detailed panels SHALL open only on request
- **AND** the removed raw relation, density, strength, connected-node, and semantic-legend commands SHALL not remain available.

#### Scenario: Local tools are collapsed
- **WHEN** retained local tools are closed
- **THEN** node-filter summaries, current domain, selected focus, and return navigation SHALL remain visible where relevant
- **AND** the legend SHALL independently communicate family state and the canvas SHALL remain primary.

#### Scenario: User opens a local tool
- **WHEN** the user opens directory, node filters, view, layout, or focus controls
- **THEN** the tool SHALL preserve current domain, selected node, family state, stored positions, and inspector context
- **AND** it SHALL not overlap global navigation or the floating dock
- **AND** keyboard focus SHALL enter and leave predictably and return to the invoking control after close.

### Requirement: Selected knowledge nodes render in a stable inspector
The knowledge workspace SHALL present selected domain and knowledge-node content through a dismissible stable inspector whose state is independent from domain navigation and progressive graph materialization.

#### Scenario: User selects a knowledge node on desktop
- **WHEN** a knowledge node has details, Knowledge Card content, relations, learning actions, or evidence sources
- **THEN** activation SHALL open or update a stable inspector with identity and explanatory content first, Knowledge Card and learning resources next, normalized prerequisite/post-requisite groups and the currently derived canonical corridor next, raw association details after them, and evidence actions afterward
- **AND** the inspector SHALL use predictable desktop overlay rules that do not cause graph relayout.

#### Scenario: User enters a domain
- **WHEN** a domain root is activated and its progressive data must load or materialize
- **THEN** navigation, selection, and inspector-open state SHALL be resolved independently
- **AND** loading or entering the domain SHALL NOT close an already valid inspector merely to signal expansion.

#### Scenario: User manually changes away from an inspected node's domain
- **WHEN** a user activates another domain while the inspector and focused corridor target a node outside that destination domain
- **THEN** navigation SHALL clear the hidden node selection and corridor before destination materialization
- **AND** the inspector SHALL close or atomically replace its content with the destination domain summary rather than retaining hidden old-domain content.

#### Scenario: User changes selected node
- **WHEN** selection changes through the canvas, inspector, directory, search, deep link, or cross-domain relation
- **THEN** inspector content SHALL update without remounting the whole workspace or accepting stale async detail responses
- **AND** cross-domain selection SHALL first enter the target node's owning domain and then present the target details.

#### Scenario: Inspector content updates asynchronously
- **WHEN** details, Knowledge Card metadata, child membership, relations, or evidence sources load for the current node
- **THEN** async updates SHALL preserve the user's active inspector section and scroll context where possible
- **AND** they SHALL NOT reset reading position solely because data returned after the inspector opened.

#### Scenario: Child relation is hidden on the canvas
- **WHEN** a selected domain or knowledge node has canonical `contains` provenance while the child family is disabled
- **THEN** the inspector SHALL still expose domain membership or direct child detail, canonical source and target, and contributing relation evidence
- **AND** the user SHALL be able to enable the child family without losing inspector context.

#### Scenario: Raw relation rationale is unavailable
- **WHEN** a canonical link provides id, type, endpoints, and strength but no rationale, evidence, or source document
- **THEN** the inspector SHALL show the available fields and `关系依据未提供`
- **AND** it SHALL not fabricate or imply unavailable evidence.

#### Scenario: Directed association detail is inspected
- **WHEN** the selected node participates in a directed raw association
- **THEN** the inspector SHALL render a reviewed Chinese sentence appropriate to whether the selected node is the authored source or target
- **AND** the sentence SHALL preserve raw type and endpoint direction even though the canvas association edge is unordered.

#### Scenario: User activates blank canvas space
- **WHEN** the user activates canvas space that is not a node, edge control, local tool, or inspector surface
- **THEN** the selected-node inspector SHALL close
- **AND** current domain, filters, zoom, pan, cached shards, path focus, and node coordinates SHALL remain unchanged.

#### Scenario: User starts dragging the canvas or a node
- **WHEN** the user begins a canvas pan or node drag while the inspector is open
- **THEN** the inspector SHALL close before manipulation continues
- **AND** dismissal SHALL not leave the current domain, trigger relayout, clear the focused corridor, or evict cached shards.

#### Scenario: Mobile knowledge graph opens a selected node
- **WHEN** a node is opened on a mobile viewport
- **THEN** details SHALL render through a focus-contained drawer or sheet with the same content priority
- **AND** graph pan, zoom, return navigation, and local tool access SHALL remain reachable when the sheet is collapsed
- **AND** focus SHALL return to the invoking graph context when the sheet closes.

### Requirement: Knowledge workspace publishes selected context to the shared assistant
The knowledge workspace SHALL publish stable selected-node and graph-state context for the shared Konling assistant without coupling hover preview or local UI internals to assistant permissions.

#### Scenario: Selected node changes
- **WHEN** the user selects a different graph node
- **THEN** the knowledge workspace SHALL update the assistant context with the selected node and current explicit graph state
- **AND** the update SHALL not rebuild graph layout or remount the shared assistant.

#### Scenario: User only hovers a node
- **WHEN** the user hovers over a graph node without selecting it
- **THEN** hover preview MAY show local UI information
- **AND** hover SHALL NOT become durable Konling context unless the user explicitly selects or focuses that node.

### Requirement: Knowledge graph first render is collapsed and root-first
The knowledge graph SHALL render a compact top-level domain chooser before requesting or parsing domain members or the full graph.

The root-first presentation SHALL NOT weaken canonical validation. Before root, progressive, full, or detail output returns any node, the loader SHALL parse the complete canonical relation source and execute the shared strict relation contract. Malformed JSONL, an empty relation source, missing/empty/unknown type, duplicate relation ID, reverse child membership, or unresolved endpoint SHALL return bounded machine-readable HTTP 422 diagnostics and SHALL NOT expose a partial graph.

Database fallback, graph version fingerprints, progressive shards, and detail inspection SHALL consume only relation rows whose `metadata.runtimeSource` exactly identifies the current canonical runtime relation source. External or unowned rows SHALL remain stored but SHALL NOT enter canonical graph output, counts, fingerprints, projection, or inspection.

DB strict validation SHALL read every relation carrying that current runtime source marker before endpoint validation, including relations whose endpoints are inactive or external. It SHALL validate them against active canonical nodes whose `metadata.source` equals the canonical runtime node marker; no active-node join or external-node inclusion may silently remove an invalid relation. Runtime-owned relations to inactive, external, or otherwise absent canonical endpoints SHALL block root, full, progressive, list, and detail output with unresolved-endpoint HTTP 422 diagnostics.

Canonical file absence SHALL be distinguished from invalid content. Only a genuinely absent canonical node or relation file may select DB fallback. A present malformed or empty node file, duplicate node ID, or blank/whitespace/overlong canonical node ID SHALL fail closed with machine-readable HTTP 422 diagnostics. Cached file output SHALL be reused only after a fresh stable size, modification-time, and SHA-256 fingerprint confirms both canonical files are unchanged; an empty, malformed, or unknown-type mutation SHALL invalidate cached output within the same TTL.

DB canonical node loading and every public node list SHALL include only active nodes carrying the exact canonical node source marker. External/unowned nodes and their raw metadata, content, and resources SHALL NOT enter root, full, remaining, list, or detail DTOs. The legacy `source=db` query SHALL use the same runtime-only sanitized loader contract and SHALL NOT bypass it with a direct raw Prisma response.

Canonical DB nodes, every current runtime-owned relation, and relation count/fingerprint version evidence SHALL be read inside one Prisma `RepeatableRead` transaction with bounded wait, timeout, and transient-conflict retry. The payload and `versionDigest` SHALL be constructed from that one snapshot. Root, full, progressive, list, and detail paths SHALL reuse the snapshot result and SHALL NOT independently re-query fingerprint evidence. If a same-count canonical seed or update commits between the node and relation reads, one request SHALL be entirely old or entirely new; a subsequent request SHALL expose the new digest and shard version without mixing node, relation, provenance, or version evidence.

The database projection SHALL preserve multiple canonical relation IDs for one endpoint pair. Migration SHALL NOT infer historical ownership from endpoint ownership. Canonical seed SHALL claim rows only by exact canonical relation ID, validate all nodes and relations before its single synchronization transaction, and delete stale rows only inside the explicit runtime ownership boundary.

#### Scenario: Learner opens the knowledge graph
- **WHEN** a learner opens `/knowledge`
- **THEN** the first visible payload SHALL contain only stable chapter/domain roots and root summaries arranged in a compact collision-safe cluster near the canvas center
- **AND** roots SHALL use a larger bounded visual scale than ordinary knowledge nodes
- **AND** the first view SHALL NOT use a distant full ring or require the full graph endpoint, all knowledge nodes, or all relations.

#### Scenario: Runtime chapter metadata is available
- **WHEN** runtime knowledge nodes include chapter metadata
- **THEN** stable chapter roots SHALL define the top-level domains unless a reviewed graph-root catalog declares a replacement
- **AND** inferred concept hierarchy SHALL NOT create additional top-level domains without a deterministic review contract.

### Requirement: Knowledge graph loads matching and remaining graph data progressively
The knowledge graph SHALL load root and active-domain data progressively without exposing remaining-graph density as a normal learner control.

#### Scenario: Root domains are visible
- **WHEN** the compact root graph has rendered
- **THEN** the client MAY preload version-valid domain summaries or the next required domain shard
- **AND** it SHALL not make all knowledge nodes or all associations visible.

#### Scenario: User enters a domain
- **WHEN** a domain root is activated
- **THEN** the client SHALL request only missing shards required for that domain, retained node filters, and three-family projection
- **AND** already loaded nodes and links SHALL be reused without duplicate graph objects or full-graph loading.

#### Scenario: User changes retained filters or family visibility
- **WHEN** chapter/domain navigation, node metadata filters, search, or family state changes
- **THEN** the graph SHALL reuse cached canonical data and request only missing domain-scoped shards
- **AND** enabling `全部` SHALL not trigger global remaining-graph materialization or expose other domains.

### Requirement: Knowledge graph shard cache is explicit and versioned
The knowledge graph SHALL identify learner root and domain payloads by graph version and shard keys while restricting remaining/full graph shards to authorized diagnostics or maintenance.

#### Scenario: Learner shard is requested
- **WHEN** normal `/knowledge` interaction requests root or active-domain data
- **THEN** the request or response SHALL include graph version and shard identity
- **AND** the client SHALL record loaded and loading keys, node ids, and link keys without treating global remaining shards as learner density controls.

#### Scenario: Domain shard data is merged
- **WHEN** a version-valid domain shard arrives
- **THEN** nodes SHALL merge by node id and links by stable canonical key
- **AND** merging SHALL not remount existing nodes, reset inspector context, or discard applicable user positions.

#### Scenario: Runtime graph version changes
- **WHEN** graph version changes
- **THEN** stale root, domain, mapping, and layout records SHALL be invalidated or ignored
- **AND** a new root version SHALL be established before domain, ResourceNode, or lesson-overlay mappings are trusted.

#### Scenario: Authorized diagnostics request remaining data
- **WHEN** an authorized diagnostics or maintenance path requests remaining or full graph shards
- **THEN** those shards SHALL remain separately identified from learner root/domain cache state
- **AND** they SHALL not make global dense data or removed controls available in normal learner flows.

### Requirement: Knowledge graph keeps full graph loading out of normal user flows
The knowledge graph SHALL keep full graph and global remaining-shard access outside normal learner interaction, including the compact `全部` family control.

#### Scenario: First render is measured
- **WHEN** tests inspect `/knowledge` first render
- **THEN** the page SHALL not request, parse, or depend on the full graph endpoint before compact root nodes are visible
- **AND** spinner-only or global dense states SHALL not be accepted as first render.

#### Scenario: User enables all relation families
- **WHEN** the user activates `全部` inside an active domain
- **THEN** only child, post-requisite, and bounded one-hop association eligibility for that domain SHALL change
- **AND** the action SHALL not request the global full graph or remaining relations from unrelated domains.

#### Scenario: Diagnostics request full graph access
- **WHEN** an authorized diagnostics or maintenance path requests full graph data
- **THEN** that path SHALL remain outside normal `/knowledge` learner interaction
- **AND** it SHALL not restore removed raw-semantic or dense-mode controls to the learner workspace.

### Requirement: Knowledge graph nodes use direct activation semantics
The knowledge graph SHALL make domain roots the direct navigation controls and ordinary knowledge nodes the direct selection and inspection controls.

#### Scenario: User activates a domain root
- **WHEN** pointer or keyboard activation targets a domain root
- **THEN** the graph SHALL enter that domain through the shared navigation resolver without requiring a secondary expansion button
- **AND** repeated activation SHALL not recursively create another ring or sector.

#### Scenario: User activates a knowledge node
- **WHEN** pointer or keyboard activation targets a knowledge node in the active domain
- **THEN** the graph SHALL select the node, focus its bounded canonical post-requisite corridor, and open or update the inspector
- **AND** it SHALL not close the inspector as an expansion side effect.

#### Scenario: User activates a related item in another domain
- **WHEN** an inspector relation, directory item, search result, or deep link resolves to a knowledge node outside the active domain
- **THEN** the shared resolver SHALL enter the owning domain before selecting the target
- **AND** pointer, keyboard, and semantic-node activation SHALL produce equivalent navigation and focus state.

#### Scenario: Progressive payload identifies domain membership
- **WHEN** root or expansion payloads return graph nodes
- **THEN** each ordinary knowledge node SHALL retain deterministic domain ownership sufficient for navigation
- **AND** the client SHALL not infer nested hierarchy from arbitrary incident relations.

### Requirement: Knowledge graph expansion motion explains local topology
The knowledge graph SHALL use bounded transition motion for domain entry, an ambient directional flow layer on eligible structural edges, and prominent continuous directional path motion for a selected post-requisite corridor. All continuous motion SHALL be paint-level: node coordinates, deterministic packing, label placement, and hit areas SHALL remain frozen, and no motion SHALL reheat layout simulation.

#### Scenario: Domain view is entered
- **WHEN** a domain's knowledge nodes become visible
- **THEN** the graph MAY use a short bounded transition from the domain center to stable final coordinates
- **AND** the transition SHALL finish promptly without continuous orbit, radial ray, or force-driven drift.

#### Scenario: Ambient flow renders on structural edges
- **WHEN** a domain view is visible and no reduced-motion preference is active
- **THEN** small directional markers SHALL travel along the visible post-requisite structural-foreground edges from source boundary to target boundary, following each rendered path's tangent
- **AND** concurrent ambient markers SHALL be deterministically selected within a documented budget that preserves the performance frame budget
- **AND** ambient markers SHALL use a subdued, family-tinted treatment distinct from the prominent selected-corridor markers
- **AND** shared segments and simultaneous branches SHALL be deduplicated or bounded to avoid visual noise.

#### Scenario: Ambient flow pauses when unseen or unfocused
- **WHEN** the browser tab is hidden, the canvas is outside the viewport, or a domain transition is mid-flight
- **THEN** ambient marker advancement SHALL pause rather than consuming frame budget offscreen.

#### Scenario: Selected path corridor is focused
- **WHEN** a selected knowledge node has eligible canonical prerequisite ancestors or post-requisite descendants
- **THEN** small directional arrows SHALL travel from source boundary to target boundary along the exact rendered straight or curved post-requisite edges
- **AND** each marker SHALL follow the path tangent, disappear at the terminal node, pause, and restart at the path origin
- **AND** corridor markers SHALL remain visually prominent above the ambient flow layer
- **AND** shared segments and simultaneous branches SHALL be deduplicated or bounded to avoid visual noise.

#### Scenario: Path corridor is not focused
- **WHEN** no knowledge node is selected
- **THEN** prominent looping corridor markers SHALL stop while the subdued ambient flow layer MAY continue within its budget
- **AND** static edge and target-arrow semantics SHALL remain available.

#### Scenario: User prefers reduced motion
- **WHEN** `prefers-reduced-motion: reduce` is active
- **THEN** domain interpolation, ambient flow markers, and looping corridor markers SHALL stop or become immediate state changes
- **AND** static focus, edge, endpoint, loading, success, and error states SHALL preserve equivalent meaning.

### Requirement: Runtime semantic review invalidation is item-scoped and auditable
Runtime lesson/media governance SHALL derive current review state from each reviewed item's bound source, manifest, and evidence hashes without manufacturing human confirmation.

#### Scenario: Reviewed evidence changes
- **WHEN** any reviewed source, manifest, or evidence hash differs from the current file hash
- **THEN** that item SHALL become `pending-rereview` with a stale reason and both reviewed and current hashes
- **AND** its review item, workqueue item, audit row, and projection SHALL not continue to display `human-confirmed`
- **AND** summary counts SHALL be calculated from item states rather than lesson identifiers or sentinel resources.

#### Scenario: Governance artifacts are regenerated without input changes
- **WHEN** the formal generation command runs twice over identical files
- **THEN** the second run SHALL produce byte-identical source, review-item, workqueue, summary, and evidence artifacts
- **AND** pending human review MAY be reported separately from generator failure without changing those artifacts.

#### Scenario: Supported relation projection is validated
- **WHEN** the presentation coverage checker evaluates canonical relation types
- **THEN** `contains` SHALL use child with preserved parent-to-child source direction
- **AND** `prerequisite`, `provides_foundation`, `follows`, and `leads_to` SHALL use post-requisite with preserved source-to-target earlier-to-later direction
- **AND** `applies_to`, `opposite`, `related`, `cross_domain`, `generalizes`, `instance_of`, `supports`, `enables`, `complements`, `contrasts_with`, `derives`, `describes_migration_of`, `determines`, `embodies`, `informs`, `quantified_by`, `uses`, `visualized_by`, `causes`, `demonstrates`, `equivalent_to`, `exemplifies`, `extends`, `has_stage`, `precedes`, `produces`, `provides_context`, `refined_by`, and `refines` SHALL use unordered association presentation while preserving authored direction in inspector provenance
- **AND** `defines`, `governs`, `implements`, and `influences` SHALL normalize to `related`, `example` to `instance_of`, and `explains` to `informs` before projection
- **AND** `引出机械建模` and `引出电路建模` SHALL normalize to `leads_to`, `机电类比` to `cross_domain`, `非线性扩展` to `generalizes`, `建模基础` to `provides_foundation`, and `电路应用` to `applies_to`
- **AND** no endpoint reversal SHALL be inferred from an unregistered relation name.

#### Scenario: Zero-instance follows contract is validated
- **WHEN** a coverage fixture uses `follows` even though current runtime data has no instance
- **THEN** its authoring grammar SHALL be `source is followed by target / target 是 source 的学习后续`
- **AND** source-to-target SHALL normalize as earlier-to-later without name-based reversal.

#### Scenario: Association contracts are independent of runtime instance count
- **WHEN** coverage fixtures evaluate `causes`, `demonstrates`, `equivalent_to`, `exemplifies`, `extends`, `has_stage`, `precedes`, `produces`, `provides_context`, `refined_by`, or `refines` with zero runtime instances
- **THEN** every type SHALL still have association family, unordered canvas direction, Chinese label, source/target inspector sentences, and unavailable-evidence fallback contracts
- **AND** `equivalent_to` SHALL say equivalence holds only under declared models and conditions
- **AND** none of these types SHALL enter child membership, post-requisite corridor, teaching order, or motion eligibility.

#### Scenario: Direction-sensitive association distinctions are preserved
- **WHEN** `precedes`, `has_stage`, `provides_context`, `refined_by`, `refines`, or `extends` is inspected
- **THEN** `precedes` SHALL describe process or parameter evolution rather than a `follows` inverse, `has_stage` SHALL describe process state rather than child membership, and `provides_context` SHALL remain distinct from `provides_foundation`
- **AND** `refined_by` SHALL not imply endpoint reversal or alias conversion without an explicit contract
- **AND** `extends` SHALL preserve the authored source-to-target meaning instead of applying English-name endpoint inference.

#### Scenario: Specialized relation types exist
- **WHEN** specialized relations such as `cross_domain`, `generalizes`, `instance_of`, `supports`, `enables`, `opposite`, or `applies_to` exist
- **THEN** their authored semantics SHALL remain available in the inspector and diagnostics
- **AND** their canvas edge MAY use the shared association family without deleting or rewriting the canonical relation.

### Requirement: Evidence state parity across canvas, legend, and inspector

The knowledge workspace SHALL present one consistent evidence vocabulary: the graphical relation legend SHALL include an evidence-available versus evidence-unavailable swatch pair, and inspector relation rows SHALL continue to show evidence state or the honest `关系依据未提供` fallback, so the same edge never appears verified in one surface and unverified in another. Evidence presentation SHALL use platform tokens and SHALL NOT invent evidence where none exists.

#### Scenario: Legend explains the evidence dimension
- **WHEN** the relation legend is visible
- **THEN** it SHALL include a graphical swatch pair distinguishing evidence-available from evidence-unavailable edges
- **AND** the swatches SHALL match the canvas modulation in the active theme.

#### Scenario: Canvas and inspector agree
- **WHEN** a user selects a node whose relations include both evidence-available and evidence-unavailable edges
- **THEN** each inspector relation row's evidence presentation SHALL match the canvas modulation of the same relation
- **AND** relations without evidence SHALL show the honest `关系依据未提供` wording rather than fabricated support.

### Requirement: Knowledge graph nodes present concept macro-categories

The knowledge graph SHALL classify nodes into six teaching-oriented concept macro-categories (systems, models, methods, criteria-and-metrics, phenomena-and-objects, constraints-and-tasks) for presentation purposes. The classification SHALL be sourced from a node's `conceptKind` when present (grouping ActKG's fifteen concept kinds into the six categories), and SHALL otherwise fall back to the existing `nodeType`/`knowledgeDim` mapping so current data receives sensible categories today. Macro-category presentation SHALL use shape or token-role cues in addition to any color, and uncategorized nodes SHALL render in the neutral default presentation.

#### Scenario: Concept kind takes precedence when present
- **WHEN** a node carries `conceptKind`
- **THEN** its macro-category SHALL be derived from the concept-kind grouping table
- **AND** nodes whose `conceptKind` differs but maps to the same macro-category SHALL share one presentation.

#### Scenario: Current data falls back to legacy mapping
- **WHEN** a node omits `conceptKind`
- **THEN** its macro-category SHALL be derived from the existing `nodeType`/`knowledgeDim` mapping
- **AND** the rendered presentation SHALL remain readable in both themes without relying on color alone.

#### Scenario: Unknown kind renders neutral
- **WHEN** a node carries a `conceptKind` outside the grouping table
- **THEN** it SHALL render in the neutral default node presentation and the unknown kind SHALL be surfaced for contract review rather than silently guessed.

### Requirement: Knowledge graph governs candidate node visibility

Nodes carrying `candidate: true` SHALL be treated as governance candidates: learner-facing graph views SHALL exclude them by default, while teacher or review contexts MAY display them with a dashed candidate outline and a candidate badge so they are never mistaken for reviewed knowledge. Candidate filtering SHALL NOT alter the visibility of non-candidate nodes or edges, except that edges touching an excluded candidate SHALL be hidden with it.

#### Scenario: Learner view excludes candidates
- **WHEN** a learner-facing view renders a graph containing `candidate: true` nodes
- **THEN** those nodes and their incident edges SHALL NOT appear on the canvas, in the legend counts, or in default label layout.

#### Scenario: Teacher review shows candidates distinctly
- **WHEN** a teacher or review context renders the same graph
- **THEN** candidate nodes SHALL appear with a dashed outline and candidate badge distinct from reviewed nodes
- **AND** their incident edges SHALL render with the candidate-muted treatment in addition to any evidence modulation.

### Requirement: Root domain bubbles render with layered vitality

Root domain bubbles SHALL present a layered, lively treatment built from platform tokens: an offset inner highlight, a rim-light arc, a soft outer halo, and a slow breathing glow on the active or hovered bubble. All vitality effects SHALL be paint-level: bubble centers, radii, packing, hit areas, and the always-visible internal full-name labels SHALL remain exactly as the deterministic root layout defines them. A bounded entrance stagger MAY play when the root view mounts and SHALL finish promptly.

#### Scenario: Bubble depth layers render
- **WHEN** the root view is visible in light or dark theme
- **THEN** each domain bubble SHALL render an offset inner highlight, rim-light arc, and outer halo derived from platform tokens
- **AND** the full domain name SHALL remain completely visible inside the bubble with no vitality effect overdrawing the label.

#### Scenario: Active bubble breathes
- **WHEN** a root bubble is active or hovered and reduced motion is off
- **THEN** its halo and glow SHALL pulse slowly within bounded intensity
- **AND** the bubble's geometry and every other bubble's presentation SHALL remain unchanged.

#### Scenario: Root entrance is bounded
- **WHEN** the root view mounts
- **THEN** bubbles MAY appear with a short staggered fade-and-settle sequence that completes within a documented duration
- **AND** after the sequence the presentation SHALL be identical to a re-render of the same state.

#### Scenario: Reduced motion collapses vitality
- **WHEN** `prefers-reduced-motion: reduce` is active
- **THEN** breathing and entrance stagger SHALL be disabled
- **AND** the static layered depth treatment SHALL still distinguish active from inactive bubbles.

### Requirement: Knowledge workspace provides an explicit migration-period graph switch
The knowledge workspace SHALL let every currently authorized graph user switch between the candidate ActKG graph and the Legacy graph, defaulting to the candidate when available.

#### Scenario: Candidate ReleaseSet is available
- **WHEN** an authorized teacher or student opens the workspace
- **THEN** the workspace SHALL select the candidate view and provide a clearly labeled Legacy switch

#### Scenario: User changes version
- **WHEN** the user selects the other graph version
- **THEN** the workspace SHALL replace the graph and detail state from the selected independent API without merging nodes

### Requirement: Authority shard merge preserves workspace state
The knowledge workspace SHALL merge version-valid Authority shards by canonical object identity and layer-aware relation identity. Shard arrival SHALL NOT duplicate multi-domain objects, remount existing nodes, reset the inspector, discard user positions or mix optional teaching data from another projection version.

#### Scenario: Secondary-domain membership arrives
- **WHEN** a later shard references an already loaded object through another reviewed domain membership
- **THEN** the workspace SHALL reuse the existing object and add only the membership context
- **AND** the object's selection, position and open detail state SHALL remain stable

#### Scenario: Version-mismatched shard arrives
- **WHEN** a shard does not match the established Authority, catalog or applicable teaching identity
- **THEN** the workspace SHALL reject it before state merge
- **AND** it SHALL request the matching shard or show a controlled unavailable state

### Requirement: Authority relation controls use five human semantic groups
The knowledge workspace SHALL present teaching order as the default group and SHALL offer structure, derivation-and-representation, application-and-analysis, and association as independently selectable groups. The controls SHALL preserve active domain, selection, cached shards, layout and inspector state.

#### Scenario: User changes relation groups
- **WHEN** one or more relation groups are enabled or disabled
- **THEN** only eligible published edges in the active domain SHALL change visibility
- **AND** the workspace SHALL not request the global graph, reset positions or replace exact predicates in the inspector

### Requirement: Layered workspace remains usable with incomplete teaching projection
The workspace SHALL keep domain objects, engineering filters, search, directory and node inspection available when teaching coverage is partial, empty or unavailable.

#### Scenario: Teaching layer becomes unavailable after domain entry
- **WHEN** the optional teaching shard fails while Authority and catalog shards remain valid
- **THEN** the workspace SHALL remove or mark only the teaching layer
- **AND** current engineering objects, selection and loaded engineering relations SHALL remain usable

### Requirement: Authority inspector resolves card and infograph resources through source-owned contracts
The knowledge workspace SHALL resolve Knowledge Card and infograph availability through their governed export and authorized media contracts. The graph client SHALL NOT construct repository paths, bypass card review status or treat an infograph as proof of an unpublished graph relation.

#### Scenario: Inspector requests learning resources
- **WHEN** a selected Authority object advertises card or infograph availability through a matching composite shard envelope
- **THEN** the workspace SHALL use the source-owned detail and media routes
- **AND** stale selection responses SHALL be discarded before presentation

#### Scenario: Selected node has no bound Teaching content
- **WHEN** the current composite shard envelope does not report an available, passed Teaching binding
- **THEN** the workspace SHALL not read an independently current card or projection index
- **AND** it SHALL keep the semantic inspector available without rendering optional media placeholders

#### Scenario: Node selection changes during media load
- **WHEN** the user selects another node before the prior card or image request completes
- **THEN** the inspector SHALL show only the current node's detail
- **AND** the stale response SHALL not replace content or focus state

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
Formula expressions and declared Knowledge Card mathematical nodes in every knowledge-card entry point, including the active inspector and standalone card view, SHALL use the shared LaTeX/KaTeX renderer, admitted macro configuration, HTML+MathML accessibility, and valid-formula copy behavior. Knowledge Card Markdown SHALL remain the content truth and SHALL continue to define its inline and block math boundaries. A content block that cannot be rendered safely MAY fail closed at that block in development while leaving semantic detail, relations, unrelated card content, and resource actions available, but the Knowledge Card MUST NOT enter formal publication until the content or shared renderer compatibility is repaired. Knowledge Card failures MUST NOT use the ActKG Authority unavailable ledger.

#### Scenario: Knowledge Card contains inline and block math
- **WHEN** an eligible Knowledge Card contains governed Markdown inline and block mathematics
- **THEN** every card entry point SHALL render both forms with the same shared mathematics configuration
- **AND** raw TeX commands SHALL not be the primary learner-visible representation

#### Scenario: User accesses formula semantics and copy
- **WHEN** a valid Knowledge Card formula is visible
- **THEN** the formula SHALL expose one current-locale accessible math description and an explicit trusted-LaTeX copy action
- **AND** it SHALL not expose rendered HTML or duplicate screen-reader narration

#### Scenario: One card formula fails validation
- **WHEN** one card math block cannot pass shared syntax, macro, safety, or rendering validation
- **THEN** development presentation MAY isolate that block while the rest of the card remains usable
- **AND** formal publication SHALL fail until repaired without converting the card to Authority rich text or assigning an Authority unavailable disposition

