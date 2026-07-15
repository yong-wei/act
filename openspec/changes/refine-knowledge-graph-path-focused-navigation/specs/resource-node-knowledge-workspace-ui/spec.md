## ADDED Requirements

### Requirement: Knowledge graph labels remain readable within bounded nodes
The knowledge graph SHALL overlay centered learner-readable labels on nodes using bounded wrapping and collision-aware layout.

#### Scenario: Knowledge node label renders
- **WHEN** an ordinary knowledge node is visible at the default readable zoom
- **THEN** its label SHALL use a platform-appropriate base size larger than the current compact caption treatment and SHALL be centered over the node
- **AND** label width MAY slightly exceed the node body without making node radius depend unboundedly on title length.

#### Scenario: Long node name renders
- **WHEN** a node name exceeds the single-line label width
- **THEN** the renderer SHALL wrap it into a bounded number of centered lines with an accessible full-name equivalent
- **AND** measured label bounds SHALL participate in layout collision and visual acceptance.

### Requirement: Selected knowledge nodes focus bounded learning-path corridors
The knowledge graph SHALL derive a bounded focused corridor only from authored canonical post-requisite relations when a knowledge node is selected.

#### Scenario: Selected node participates in prerequisite paths
- **WHEN** a selected node has post-requisite ancestors or descendants
- **THEN** the graph SHALL emphasize bounded relevant nodes and connecting post-requisite edges while dimming unrelated content enough to preserve orientation
- **AND** it SHALL not enumerate an unbounded number of complete simple paths.

#### Scenario: Canonical corridor crosses domains
- **WHEN** a bounded post-requisite corridor reaches a canonical adjacent node outside the active domain
- **THEN** the canvas SHALL emphasize only the active-domain segment and SHALL NOT inject the other-domain node
- **AND** the inspector SHALL identify the adjacent node and provide explicit navigation to its owning domain.

#### Scenario: Persisted personalized path context exists
- **WHEN** a URL, launch context, or workspace also contains persisted LearningPath or ResourceNode path data
- **THEN** this graph change SHALL ignore that data and SHALL NOT infer, fetch, map, cache, or expose it
- **AND** persisted personalized path integration SHALL require a separate authorization, versioning, governance, and privacy change.

#### Scenario: User focuses or visits a path node
- **WHEN** the learner selects, focuses, or navigates to a graph node
- **THEN** the action SHALL remain read-only navigation and SHALL not mark learning complete, satisfy prerequisites, or imply teacher progression
- **AND** completion and classroom progress SHALL remain owned by durable learning-evidence and classroom contracts.

#### Scenario: Multiple focused routes share a segment
- **WHEN** focused prerequisite routes converge, overlap, or branch
- **THEN** shared nodes and edges SHALL render once
- **AND** direction and branch separation SHALL remain readable without duplicate overlapping motion markers.

### Requirement: Knowledge graph edges connect node boundaries
The knowledge graph SHALL use one shared geometric path contract for static edge drawing, endpoint direction, hit testing, and focused motion.

#### Scenario: Single relation connects two nodes
- **WHEN** one visual relation connects a source and target node
- **THEN** the edge SHALL begin and end at intersections with the rendered node boundaries rather than the node centers
- **AND** a directed edge SHALL place one static arrowhead at the target boundary.

#### Scenario: Reciprocal or parallel relations connect a node pair
- **WHEN** multiple truthful visual relations would otherwise overlap between the same nodes
- **THEN** deterministic signed quadratic curvature SHALL separate them
- **AND** endpoint arrows and moving markers SHALL use tangents from the same curve geometry.

#### Scenario: Edge approaches a node
- **WHEN** a static or animated edge reaches a node boundary
- **THEN** it SHALL render below the node and label layers so the node naturally occludes the incoming path
- **AND** no edge or marker SHALL cover learner-facing node text.

### Requirement: Knowledge graph renderer modes preserve presentation semantics
The knowledge graph SHALL preserve navigation, relation-family, direction, label, corridor, inspector, and reduced-motion semantics across 2D and 3D renderers.

#### Scenario: User switches renderer mode
- **WHEN** the user switches between 2D and 3D inside a root or domain view
- **THEN** domain scope, selected node, family visibility, focused corridor, inspector state, and canonical edge direction SHALL remain unchanged
- **AND** equivalent node-boundary endpoints and target-arrow meaning SHALL remain visible.

#### Scenario: Renderer cannot reproduce an exact line pattern
- **WHEN** a renderer cannot express the other renderer's exact dash sequence
- **THEN** it SHALL preserve family distinction, direction, focus emphasis, endpoint semantics, and reduced-motion behavior
- **AND** it SHALL not fall back to always-on raw-semantic particles.

### Requirement: Knowledge graph materializes one domain without recursive knowledge expansion
The knowledge graph SHALL use domain activation to enter one flat domain neighborhood instead of recursively expanding knowledge nodes into repeated radial sectors.

#### Scenario: User activates a domain root
- **WHEN** a user clicks, taps, or keyboard-activates a domain root
- **THEN** the graph SHALL load or reuse that domain's expansion shard and transition to a view containing only the domain center, its chapter-metadata-scoped knowledge members, and eligible authored intra-domain relations
- **AND** scope membership SHALL NOT imply a canonical child edge
- **AND** all unrelated domain roots and members SHALL leave the canvas
- **AND** the user SHALL receive a visible accessible action to return to the root view.

#### Scenario: Domain data is loading or filtered empty
- **WHEN** the selected domain shard is uncached, fails, or has no members visible under active filters
- **THEN** the graph SHALL expose distinct loading, failure, retry, and filtered-empty states without showing unrelated domains as substitutes
- **AND** version-valid cached data SHALL remain reusable.

#### Scenario: User activates an ordinary knowledge node
- **WHEN** a knowledge node inside the active domain is activated
- **THEN** the graph SHALL select and inspect that node rather than recursively treating it as another hierarchy root
- **AND** the activation SHALL not request an expansion shard solely to infer whether currently loaded neighbors exist.

#### Scenario: User returns to all domains
- **WHEN** the user activates the root return action
- **THEN** the compact domain chooser SHALL be restored from cached root state
- **AND** domain member positions and data MAY remain cached without remaining visible.

### Requirement: Knowledge graph domain layout follows explicit teaching order
The knowledge graph SHALL replace repeated outward-sector expansion with deterministic compact root packing and prerequisite-constrained single-domain layout.

#### Scenario: Root domain chooser renders
- **WHEN** stable domain roots are visible
- **THEN** they SHALL use compact deterministic packing with node and label collision bounds near the viewport center
- **AND** no decorative ring, ray, or non-semantic line SHALL determine their visible relationship.

#### Scenario: Domain knowledge view renders
- **WHEN** a domain's direct knowledge members are materialized
- **THEN** without active lesson context, normalized post-requisite relations SHALL determine teaching order along a bounded spiral scaffold
- **AND** with active lesson context, runtime graph-overlay `card_order` SHALL preserve the relative order of covered lesson nodes before post-requisite ordering fills uncovered nodes
- **AND** earlier concepts SHALL be nearer the center than later concepts where canonical order permits
- **AND** association direction and child membership SHALL not be inferred as learning order or pull nodes into false hierarchy
- **AND** order-only sources SHALL not create a visible edge without canonical relation provenance.

#### Scenario: Active lesson supplies teaching order
- **WHEN** `/knowledge?lessonId=<runtimeLessonId>` or a trusted launch context explicitly supplies the same lesson id
- **THEN** the server SHALL validate an exact runtime lesson directory id and return a sanitized `lessonContext` containing only lesson id, deterministic `overlayRevision`, canonical `cardOrderNodeIds`, and mapping gaps
- **AND** when knowledge-card `sequence.json.card_order` exists it SHALL be the reviewed teaching-order source and manifest `card_order` SHALL match exactly
- **AND** manifest-only order SHALL be allowed only when sequence is absent and manifest contains exactly `graph_order_policy: "manifest-reviewed-no-sequence"`; that field SHALL be forbidden when sequence exists, and absence or another value SHALL block review/export
- **AND** any manifest/sequence mismatch, including current `1-1`, `4-2`, and `5-2` migration fixtures, SHALL be made exactly equal before review and export can pass and SHALL NOT be waived by review
- **AND** runtime `graph-overlay.json.card_order` SHALL be exported only from that reviewed resolver
- **AND** `overlayRevision` SHALL hash exactly `{ "cardOrder": string[], "lessonId": string, "links": NormalizedLink[] }` using RFC 8785 JCS encoded as UTF-8 without BOM and lowercase-hex SHA-256
- **AND** each link SHALL contain exactly normalizedType, relationId, sourceId, strength, and targetId; missing id SHALL become `""`, missing/non-finite strength SHALL become `null`, and links SHALL sort by `(sourceId, targetId, normalizedType, relationId, strengthKind, strengthValue)` where null maps to `(0,0)` and finite values to `(1,value)` while cardOrder preserves teaching order
- **AND** Python review/export and the TypeScript runtime loader SHALL pass shared canonical-byte and digest vectors covering Chinese, missing id, null, negative, zero, `1.0`, equal-prefix links, and input reordering.
- **AND** lesson order SHALL read only `course-content/runtime/lessons/<activeLessonId>/graph-overlay.json.card_order` without calling any `lesson.json`, authoring, alias, or another-lesson fallback
- **AND** missing, invalid, traversing, deleted, changed, or cleared lesson context SHALL produce `lessonContext: null`, clear stale lesson order, and deterministically recalculate layout.

#### Scenario: Runtime lesson overlay references graph content
- **WHEN** active-lesson `card_order` entries or overlay links are projected into the graph workspace
- **THEN** each ordered node SHALL resolve exactly to one canonical node in the active graph version before it may affect layout
- **AND** an overlay link SHALL reference an existing visible edge only when its canonical source id, target id, and normalized relation type exactly match an authored canonical relation
- **AND** reverse, missing, duplicated, ambiguous, stale, synthetic, or non-canonical matches SHALL surface overlay gaps and SHALL NOT render or animate, including unmatched links in `1-1`, `2-1`, `2-2`, `2-3`, and `cruise-comfort-boppps`.

#### Scenario: No lesson is explicitly active
- **WHEN** neither canonical URL nor trusted launch context supplies a valid `lessonId`
- **THEN** the graph SHALL skip lesson-derived ordering even when visible nodes occur in one or more lesson overlays
- **AND** normalized post-requisite ordering SHALL remain eligible.

#### Scenario: Post-requisite graph contains a cycle
- **WHEN** domain relations contain a directed prerequisite cycle
- **THEN** the layout SHALL condense the strongly connected component into one depth band
- **AND** it SHALL preserve reciprocal diagnostic curves, label the group `需共同理解或待审查`, and avoid earlier-to-later motion inside the component
- **AND** it SHALL not invent an arbitrary earlier member.

#### Scenario: Knowledge nodes lack post-requisite relations
- **WHEN** one or more domain members have no valid explicit-active-lesson order or post-requisite order
- **THEN** they SHALL use a bounded collision-safe region labeled `尚无可验证的先后关系`
- **AND** the layout SHALL not imply a fabricated learning order.

#### Scenario: User has positioned graph nodes
- **WHEN** user-positioned coordinates remain applicable to the active domain and graph version
- **THEN** those coordinates SHALL remain authoritative until explicit relayout or reset
- **AND** entering, selecting, inspecting, focusing, or filtering SHALL not relocate unrelated established nodes.

### Requirement: Relation-family visibility remains user controlled
The knowledge graph SHALL let learners explicitly control the three presentation families without restoring the removed raw-semantic legend or silently changing domain scope.

#### Scenario: User enables all presentation families
- **WHEN** the user enables `全部`
- **THEN** child, post-requisite, and association edges for the active domain SHALL become eligible
- **AND** child eligibility SHALL include only authored canonical `contains` records, never synthetic chapter membership links
- **AND** raw relation types SHALL remain consolidated within those families and detailed through the inspector.

#### Scenario: User restores the default relation set
- **WHEN** the user activates `全部` while every family is enabled or individually disables child
- **THEN** the graph SHALL restore or retain the default post-requisite-plus-association set
- **AND** current domain, selection, inspector, corridor, viewport, and shard state SHALL remain consistent.

## MODIFIED Requirements

### Requirement: Graph relationship lines encode relation meaning
The knowledge graph SHALL project canonical runtime relations into child, post-requisite, and association presentation families while preserving every contributing raw relation for detail inspection and diagnostics.

#### Scenario: Graph renders learner-facing relation families
- **WHEN** canonical links are prepared for the learner-facing canvas
- **THEN** `contains` SHALL map to child, reviewed prerequisite/foundation/follows/leads-to semantics SHALL map to post-requisite in normalized learning order, and all remaining relations SHALL map to association
- **AND** child and post-requisite edges SHALL preserve direction through a target-boundary arrow while association edges SHALL remain visually undirected
- **AND** the three families SHALL remain distinguishable in light and dark themes without relying on color alone.

#### Scenario: Domain shard contains virtual chapter membership
- **WHEN** an expansion payload contains a synthetic `chapter-link:*` membership generated by `chapterRootLinks()`
- **THEN** that link SHALL define domain scope only and SHALL NOT enter canonical relation projection, the `子级` family, edge rendering, or raw relation inspection
- **AND** only authored canonical `contains` relations MAY produce child edges.

#### Scenario: Multiple raw relations map to one visual edge
- **WHEN** exact duplicate directed relations share a canonical normalized key or multiple association semantics connect the same unordered node pair
- **THEN** the canvas SHALL deduplicate them into the minimum truthful visual edge set without reversing endpoints by relation name
- **AND** the selected-node inspector SHALL retain every contributing raw relation type, strength, rationale, source, and canonical direction.

#### Scenario: Reverse child membership is authored
- **WHEN** canonical data contains both `contains A→B` and `contains B→A`
- **THEN** presentation validation SHALL report a blocking membership error and SHALL render neither child edge until the canonical conflict is repaired
- **AND** diagnostics SHALL retain both raw links as error provenance.

#### Scenario: Genuine reciprocal post-requisite relations exist
- **WHEN** two normalized post-requisite relations connect the same node pair in opposite learning-order directions
- **THEN** the graph SHALL render deterministic reciprocal curves rather than overlapping straight edges
- **AND** association relations on the same pair SHALL remain one unordered association edge
- **AND** each post-requisite target direction SHALL remain recoverable from its boundary arrowhead.

#### Scenario: Different presentation families connect the same node pair
- **WHEN** child, post-requisite, or association relations coexist on one node pair
- **THEN** each enabled family SHALL retain a separate visual edge with stable family-specific separation
- **AND** disabling one family SHALL not remove the provenance or visual edge of another family.

### Requirement: Relation legend and filters are part of the workspace
The knowledge graph SHALL expose a compact graphical relation-family control aligned with the shared shell and floating action dock.

#### Scenario: Knowledge graph opens with default relation visibility
- **WHEN** the learner-facing graph first renders
- **THEN** post-requisite and association eligibility SHALL be enabled and child relations SHALL be disabled
- **AND** no association edge SHALL render before node selection and no more than the selected node's 24 strongest one-hop association edges SHALL render afterward
- **AND** the canvas SHALL NOT show a permanent full raw-semantic legend or require learners to manage every canonical relation type.

#### Scenario: User changes relation-family visibility
- **WHEN** a user toggles `全部`, `子级`, `后置`, or `关联` from the compact bottom-left legend
- **THEN** the graph SHALL update the corresponding presentation families without losing domain, selected node, inspector, viewport, or cached shard state
- **AND** each graphical sample SHALL be generated from the same family style contract used by the active renderer.

#### Scenario: Compact legend renders on mobile
- **WHEN** the graph renders at a narrow viewport
- **THEN** the three-family control SHALL remain reachable through a compact button, drawer, or sheet
- **AND** it SHALL not block graph manipulation, inspector dismissal, return navigation, or the shared floating dock.

### Requirement: Runtime relation types have complete visual-semantic coverage
The knowledge graph SHALL explicitly map every runtime relation type to canonical teaching detail and to one learner-facing presentation family before rendering.

#### Scenario: Runtime graph relation types are loaded
- **WHEN** relation types are read from runtime graph files or database links
- **THEN** every distinct type SHALL have a Chinese detail label, canonical direction rule, presentation family, density policy, and inspector explanation
- **AND** unknown relation types SHALL fail validation or surface a blocking coverage gap instead of silently changing learning order.

#### Scenario: Canonical relation input is malformed or incomplete
- **WHEN** runtime JSONL is malformed or a relation has a missing or empty type, duplicate relation id, or unregistered alias
- **THEN** the coverage checker SHALL report a machine-readable blocking error instead of skipping the row or defaulting its type to `related`
- **AND** loading, labeling, projection, and inspection SHALL agree on the same failure.

#### Scenario: Supported relation projection is validated
- **WHEN** the presentation coverage checker evaluates canonical relation types
- **THEN** `contains` SHALL use child with preserved parent-to-child source direction
- **AND** `prerequisite`, `provides_foundation`, `follows`, and `leads_to` SHALL use post-requisite with preserved source-to-target earlier-to-later direction
- **AND** `applies_to`, `opposite`, `related`, `cross_domain`, `generalizes`, `instance_of`, `supports`, `enables`, `complements`, `contrasts_with`, `derives`, `describes_migration_of`, `determines`, `embodies`, `informs`, `quantified_by`, `uses`, and `visualized_by` SHALL use unordered association presentation while preserving authored direction in inspector provenance
- **AND** `defines`, `governs`, `implements`, and `influences` SHALL normalize to `related`, `example` to `instance_of`, and `explains` to `informs` before projection
- **AND** `引出机械建模` and `引出电路建模` SHALL normalize to `leads_to`, `机电类比` to `cross_domain`, `非线性扩展` to `generalizes`, `建模基础` to `provides_foundation`, and `电路应用` to `applies_to`
- **AND** no endpoint reversal SHALL be inferred from an unregistered relation name.

#### Scenario: Zero-instance follows contract is validated
- **WHEN** a coverage fixture uses `follows` even though current runtime data has no instance
- **THEN** its authoring grammar SHALL be `source is followed by target / target 是 source 的学习后续`
- **AND** source-to-target SHALL normalize as earlier-to-later without name-based reversal.

#### Scenario: Specialized relation types exist
- **WHEN** specialized relations such as `cross_domain`, `generalizes`, `instance_of`, `supports`, `enables`, `opposite`, or `applies_to` exist
- **THEN** their authored semantics SHALL remain available in the inspector and diagnostics
- **AND** their canvas edge MAY use the shared association family without deleting or rewriting the canonical relation.

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
The knowledge graph SHALL use bounded transition motion for domain entry and shall reserve continuous directional path motion for a selected post-requisite corridor.

#### Scenario: Domain view is entered
- **WHEN** a domain's knowledge nodes become visible
- **THEN** the graph MAY use a short bounded transition from the domain center to stable final coordinates
- **AND** the transition SHALL finish promptly without continuous orbit, radial ray, or force-driven drift.

#### Scenario: Selected path corridor is focused
- **WHEN** a selected knowledge node has eligible canonical prerequisite ancestors or post-requisite descendants
- **THEN** small directional arrows SHALL travel from source boundary to target boundary along the exact rendered straight or curved post-requisite edges
- **AND** each marker SHALL follow the path tangent, disappear at the terminal node, pause, and restart at the path origin
- **AND** shared segments and simultaneous branches SHALL be deduplicated or bounded to avoid visual noise.

#### Scenario: Path corridor is not focused
- **WHEN** no knowledge node is selected
- **THEN** prominent looping path markers SHALL stop
- **AND** static edge and target-arrow semantics SHALL remain available.

#### Scenario: User prefers reduced motion
- **WHEN** `prefers-reduced-motion: reduce` is active
- **THEN** domain interpolation and looping path markers SHALL stop or become immediate state changes
- **AND** static focus, edge, endpoint, loading, success, and error states SHALL preserve equivalent meaning.

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

### Requirement: Knowledge graph relation styles use semantic visual grammar
The knowledge graph SHALL render child, post-requisite, and association presentation families with distinct visual grammar that does not rely on color alone.

#### Scenario: Three relation families render together
- **WHEN** child, post-requisite, and association edges are enabled
- **THEN** each family SHALL use a distinct combination of line pattern, target-arrow behavior, opacity, and curvature
- **AND** raw relation distinctions SHALL remain available in the inspector rather than multiplying canvas grammars.

#### Scenario: Dense domain renders by default
- **WHEN** the active domain has many available relations
- **THEN** relation edges SHALL remain fine and association edges subordinate
- **AND** emphasis SHALL come from selection, corridor focus, or family visibility rather than permanently thick strokes.

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

### Requirement: Knowledge graph default view prioritizes readable structure
The knowledge graph SHALL open in a compact root view and then prioritize post-requisite learning order inside one active domain.

#### Scenario: Root view contains many domains
- **WHEN** domain roots exceed a single compact row
- **THEN** deterministic collision-safe packing SHALL preserve readable labels without expanding into a distant complete ring.

#### Scenario: Active domain contains many relations
- **WHEN** the domain has more relations than can be read at once
- **THEN** the default family set SHALL include post-requisite and association but exclude child
- **AND** association opacity and selected-corridor focus SHALL prevent weak relations from becoming the primary skeleton.

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

### Requirement: Knowledge workspace supports ResourceNode-aware exploration
The system SHALL preserve ordinary ResourceNode detail and resource exploration without exposing persisted path eligibility in the knowledge graph workspace.

#### Scenario: ResourceNode mapping exists
- **WHEN** a selected knowledge node or resource has a ResourceNode mapping
- **THEN** the UI SHALL show source reference, knowledge coverage, prerequisites, availability, privacy level, teacher policy, and evidence instrumentation where role scope permits
- **AND** `/knowledge` SHALL NOT display ResourceNode path eligibility or use it to derive layout, corridor, animation, or inspector state.

### Requirement: Resource launch actions preserve source ownership
The system SHALL launch mapped resources through existing source-owned launcher contracts without treating launchability as graph path projection.

#### Scenario: User launches a mapped resource
- **WHEN** a user launches a lesson, media item, widget, simulation, Arena task, or adaptive path node from the knowledge/resource workspace
- **THEN** the UI SHALL use the ResourceNode source reference, `registryId`, route, or feature-owned launcher contract where available
- **AND** an adaptive path node launch SHALL remain an opaque feature-owned action and SHALL NOT expose, map, or animate its persisted path in the graph
- **AND** the knowledge workspace SHALL NOT absorb resource, lesson, Arena, simulation, or adaptive-path business logic.

### Requirement: Knowledge workspace launches real learning resources
The ResourceNode knowledge workspace SHALL connect graph exploration to actual learning resources and evidence review while keeping canonical graph corridors separate from persisted personalized paths.

#### Scenario: Knowledge node with launchable resource is selected
- **WHEN** a selected node has a registered ResourceNode, course resource, simulation, lesson entry, or evidence target
- **THEN** the UI SHALL expose the source-owned launch action and return path
- **AND** the canonical corridor MAY explain authored prerequisite order but SHALL NOT inspect or project a persisted LearningPath.

## REMOVED Requirements

### Requirement: Knowledge graph nodes expand and collapse on demand
The knowledge graph SHALL reveal neighbors and relations through direct node activation instead of showing all filtered nodes by default or requiring a secondary expansion control.

#### Scenario: User activates a collapsed expandable node
- **WHEN** a user activates a collapsed node declared expandable
- **THEN** the node activation SHALL reveal its filter-visible neighbors and relations.

**Reason**: Ordinary knowledge nodes no longer create recursive hierarchy levels; retaining this identity would contradict single-domain materialization.

**Migration**: Use `Knowledge graph materializes one domain without recursive knowledge expansion`; domain roots navigate and ordinary knowledge nodes select, focus, and inspect.

### Requirement: Expanded graph neighborhoods use outward sectors
The knowledge graph SHALL arrange newly revealed neighbors in a deterministic outward sector anchored to the expanded node.

#### Scenario: Node with reveal provenance is expanded
- **WHEN** an expandable node reveals new neighbors
- **THEN** the graph SHALL orient the new-neighbor sector using reveal provenance.

**Reason**: Outward sectors and rays waste space and imply hierarchy that the domain knowledge nodes do not possess.

**Migration**: Use `Knowledge graph domain layout follows explicit teaching order` with compact roots, bounded spiral placement, and explicit unordered regions.

### Requirement: Dense relation modes remain user controlled
The knowledge graph SHALL allow learners to request denser relation views without making dense views the default.

#### Scenario: User requests all relations
- **WHEN** the user selects an all-relations or equivalent density mode
- **THEN** the graph SHALL make the dense mode explicit and reversible.

**Reason**: Raw dense-mode controls are removed in favor of bounded learner-facing relation families.

**Migration**: Use `Relation-family visibility remains user controlled`; `全部`, `子级`, `后置`, and `关联` preserve explicit control under fixed density policies.
