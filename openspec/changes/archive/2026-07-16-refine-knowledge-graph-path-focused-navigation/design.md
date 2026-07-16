## Context

The `/knowledge` workspace already loads a collapsed root payload, progressively caches expansion shards, renders 2D and 3D views, and exposes a stable ResourceNode inspector for leaf nodes. Its presentation contracts evolved through several earlier changes: all runtime relation types receive distinct visual semantics, chapter roots use a large ring, newly materialized neighbors use outward sectors, and direct activation chooses expansion, collapse, or inspection from node metadata.

Those decisions no longer match the approved product direction. Runtime data currently contains 32 raw relation types and more than sixteen thousand relations, while the learner-facing purpose of this surface is to expose plausible learning order and useful associations. Chapter membership is an organizational aid, not a deep knowledge hierarchy. The new design must therefore simplify presentation without deleting canonical semantics or breaking progressive loading, ResourceNode launch, deep links, accessibility, or stored graph evidence.

## Goals / Non-Goals

**Goals:**

- Present a compact top-level domain chooser and a single-domain knowledge view.
- Make post-requisite order the primary layout and focus signal without inventing hierarchy or decorative edges.
- Project raw relation types into child, post-requisite, and association families while retaining raw details for inspection.
- Render boundary-clipped, directionally correct edges and focused path motion that follows the exact edge geometry.
- Keep node inspection independent from domain navigation and progressive data loading.
- Improve label readability without allowing text length to create unbounded nodes or collisions.
- Preserve deterministic layout, user-positioned coordinates where applicable, reduced motion, theme parity, and mobile access.

**Non-Goals:**

- Changing canonical knowledge graph files, database relation types, K/A/Q schemas, relation evidence, or path-planning algorithms, except for evidence-driven authoring corrections required to make an existing relation's type agree with its authored description.
- Creating additional authored hierarchy below chapter/domain membership.
- Enumerating every possible simple path through a dense graph.
- Replacing ResourceNode launch, Knowledge Card, evidence, or assistant-context contracts.
- Removing 3D view; it remains an optional equivalent projection of the same visible domain and relation families.

## Decisions

### 1. Use an explicit two-level navigation state

The workspace will model `root` and `domain(domainId)` as explicit navigation states. Root state renders only reviewed chapter/domain roots and compact summaries. Activating a domain transitions to a view containing that domain center, its chapter-metadata-scoped member nodes, and eligible authored intra-domain relations; other domain roots and their members are absent from the canvas. A visible return action restores root state. Scope membership does not imply a canonical `contains` edge.

Knowledge-node activation selects and inspects the node. It does not recursively materialize a second authored hierarchy. Cross-domain relations remain available in the inspector and can navigate to the target node by first switching to its owning domain.

This replaces repeated radial expansion. Keeping all domains faintly visible was rejected because it preserves the current visual competition and wastes the space recovered by single-domain navigation.

### 2. Add a lossless presentation projection over canonical relations

Canonical links remain unchanged. A presentation helper will normalize each raw link into one of three families. The following table is normative for every currently supported canonical relation type:

| Canonical raw type | Canvas family | Canonical canvas direction | Deduplication and reciprocal policy |
| --- | --- | --- | --- |
| `contains` | child | preserve `source → target` as parent → child | `child\|source\|target`; a reverse pair is invalid canonical membership and blocks presentation |
| `prerequisite`, `provides_foundation`, `follows`, `leads_to` | post-requisite | preserve `source → target` as earlier → later | `post\|source\|target`; opposite normalized directions remain two reciprocal curves |
| `applies_to`, `opposite`, `related`, `cross_domain`, `generalizes`, `instance_of`, `supports`, `enables`, `complements`, `contrasts_with`, `derives`, `describes_migration_of`, `determines`, `embodies`, `informs`, `quantified_by`, `uses`, `visualized_by`, `causes`, `demonstrates`, `equivalent_to`, `exemplifies`, `extends`, `has_stage`, `precedes`, `produces`, `provides_context`, `refined_by`, `refines` | association | canvas is unordered; preserve authored source/target only in provenance | `association\|min(source,target)\|max(source,target)`; never reciprocal on canvas |

Input aliases are normalized before this table: `defines`, `governs`, `implements`, and `influences` become `related`; `example` becomes `instance_of`; `explains` becomes `informs`; `引出机械建模` and `引出电路建模` become `leads_to`; `机电类比` becomes `cross_domain`; `非线性扩展` becomes `generalizes`; `建模基础` becomes `provides_foundation`; and `电路应用` becomes `applies_to`. An unknown type or a new alias without an explicit row is a blocking coverage error in loading, labeling, projection, and inspector paths. No type is flipped by name inference. `follows` has the explicit authoring grammar “source is followed by target / target 是 source 的学习后续”, so its stored source-to-target direction means earlier-to-later; a zero-instance contract fixture protects that grammar. A future inverse alias may reverse endpoints only after an explicit reviewed mapping is added.

The projection retains all fields that actually exist on each contributing link: id, relation type, strength, source/target direction, chapter metadata, and source metadata when supplied. Rationale or evidence is displayed when present; otherwise the inspector says `关系依据未提供` and never fabricates provenance. Exact duplicate child or post-requisite descriptions sharing a normalized directed key collapse into one visual edge. A reverse child pair is a blocking canonical-membership error and neither direction renders until repaired. Multiple association semantics for the same unordered node pair collapse into one visual edge but remain individually listed in the inspector. Genuine opposite normalized post-requisite directions form an SCC/cycle state rather than two independent learning steps: reciprocal curves remain visible for diagnosis, the inspector labels the cycle as `需共同理解或待审查`, and no earlier-to-later motion runs within the SCC. Different families on the same node pair coexist as separate visual edges when enabled and receive stable family-specific curvature.

Relation identity is validated before presentation deduplication. One relation ID may repeat only when every occurrence resolves to the same normalized `(source, target, type)` key; those byte-independent duplicates coalesce deterministically. If one ID resolves to more than one key, export blocks regardless of whether one occurrence has explicit endpoint IDs. The seven historical conflicts were independent base and lesson relations whose chapter metadata changed while their IDs did not; the base authoring rows now carry explicit endpoints and endpoint/type-derived stable IDs. The repaired full export contains 16,571 canonical relations, with output sorted by relation ID, source, target, and type.

Directed association details use relation-specific source/target sentences instead of an undirected label alone:

| Raw relation | Source-node sentence | Target-node sentence |
| --- | --- | --- |
| `applies_to` | 本节点可应用于目标 | 本节点可接受来源方法的应用 |
| `cross_domain` | 本节点迁移到目标领域概念 | 本节点承接来源概念的跨域迁移 |
| `generalizes` | 本节点抽象推广为目标 | 本节点由来源概念抽象推广得到 |
| `instance_of` | 本节点是目标一般概念的实例 | 本节点包含来源这一具体实例 |
| `supports` | 本节点支撑目标结论 | 本节点由来源证据或概念支撑 |
| `enables` | 掌握本节点可启用目标任务或概念 | 本节点由来源概念启用 |
| `derives` | 本节点推导得到目标 | 本节点由来源推导得到 |
| `describes_migration_of` | 本节点描述目标的迁移 | 本节点的迁移由来源描述 |
| `determines` | 本节点决定或约束目标 | 本节点由来源决定或约束 |
| `informs` | 本节点为目标提供提示 | 本节点接收来源提示 |
| `quantified_by` | 本节点由目标指标或图形量化 | 本节点用于量化来源概念 |
| `uses` | 本节点使用目标方法或工具 | 本节点被来源任务或概念使用 |
| `visualized_by` | 本节点由目标图形呈现 | 本节点用于呈现来源概念 |
| `causes` | 本节点导致目标结果 | 本节点由来源条件或机制导致 |
| `demonstrates` | 本节点展示目标性质或过程 | 本节点由来源实例或表征展示 |
| `equivalent_to` | 本节点在已声明模型与条件下等价于目标 | 本节点在已声明模型与条件下等价于来源 |
| `exemplifies` | 本节点是目标性质或概念的实例 | 本节点由来源实例具体说明 |
| `extends` | 本节点的既有概念扩展到目标 | 本节点扩展来源概念的适用范围或变化维度 |
| `has_stage` | 本节点过程包含目标阶段 | 本节点是来源过程的一个状态或阶段 |
| `precedes` | 本节点在过程或参数演化中先于目标 | 本节点在过程或参数演化中后于来源 |
| `produces` | 本节点产生目标现象或结果 | 本节点由来源机制或状态产生 |
| `provides_context` | 本节点为目标提供理解语境 | 本节点的理解语境由来源提供 |
| `refined_by` | 本节点由目标进一步精化 | 本节点进一步精化来源概念 |
| `refines` | 本节点进一步精化目标概念 | 本节点由来源进一步精化 |

Bidirectional or undirected association types (`opposite`, `related`, `complements`, `contrasts_with`, `embodies`) use symmetric Chinese sentences. Aliases inherit their canonical type's sentence while retaining the authored alias in provenance.

The 11 added types remain associations regardless of directional wording. `precedes` describes process or parameter evolution and is not the inverse of `follows`; `has_stage` describes a process state and is not membership; `provides_context` is not `provides_foundation`; and `refined_by` does not reverse endpoints unless a future explicit alias contract says so. Each type has a contract fixture independent of runtime instance count. The 1-3 relation `闭环控制_1_1 → 闭环特征方程_1_3` is authored as “提供基础”, so its canonical authoring type is corrected from `refines` to `provides_foundation`. The authored `极点_1_2 → 极点迁移_1_3` `extends` relation is retained because its description explicitly extends a static concept into a parameter-varying concept in that source-to-target direction.

Flattening canonical data at load time was rejected because goal expansion, diagnostics, and detail inspection rely on the authored semantics.

Virtual chapter roots and `chapter-link:*` membership links produced by `chapterRootLinks()` are navigation-scope metadata, not canonical runtime relations. They determine active-domain membership but never enter the relation projector, the `子级` family, the inspector's raw relation list, or edge rendering. Only authored canonical `contains` records may appear as child edges.

### 3. Replace relation tools with a compact three-family legend

The canvas will remove the dedicated full semantic legend and its raw-type, density, strength, and connected-node relation controls. A compact bottom-left graphical control will expose `全部`, `子级`, `后置`, and `关联`. Post-requisite and association eligibility are enabled by default; child is disabled. Association eligibility means zero association edges before selection and at most the selected node's 24 strongest one-hop association edges after selection, ordered by strength then stable id. It never means all domain associations. Each sample comes from the same three-family presentation config used by both renderers. `全部` is a derived select-all checkbox: activating it from any partial state enables all three families under their density policies, activating it while all three are enabled restores the default `{post-requisite, association}` set, and it exposes checked/mixed state through `aria-checked="true|mixed|false"`. Desktop and mobile controls share one state.

Raw semantic names remain visible in the inspector and diagnostics. This separates learner-facing map grammar from authoring and governance coverage.

### 4. Use compact root packing and prerequisite-constrained domain layout

Root nodes use deterministic compact packing with collision and label bounds around the viewport center. No visible or invisible radial rays define their relationships.

Within a domain, runtime graph-overlay `card_order` preserves the relative order of every covered active-lesson node, and normalized post-requisite edges fill uncovered nodes. Without valid lesson context, normalized post-requisite edges are the only teaching-order source. There is no metadata-derived or persisted-personalization order source. Association direction is never inferred as learning order merely because it is directed. `card_order` can determine position but does not create a visual edge; every painted edge still requires canonical relation provenance.

`activeLessonId` exists only when `/knowledge?lessonId=<runtimeLessonId>` or a trusted launch/deep-link context explicitly supplies the same `lessonId`. Launchers propagate that field into the canonical URL; the URL is the client lifecycle truth. The graph route validates the id through a server-only exact runtime-lesson directory lookup that rejects traversal, aliases, missing lessons, and deleted lessons. Its sanitized `lessonContext` projection contains only `lessonId`, `overlayRevision`, canonical `cardOrderNodeIds`, and mapping gaps.

The authoring-order resolver has one rule: when `course-content/authoring/knowledge/cards/lessons/<lessonId>/sequence.json.card_order` exists, it is the reviewed teaching-order source and any `authoring/lessons/<lessonId>/manifest.json.card_order` must match exactly; a mismatch blocks review and export. Manifest order is allowed only when no sequence artifact exists and that manifest contains the exact machine-readable field `graph_order_policy: "manifest-reviewed-no-sequence"`; the field is forbidden when sequence exists, and absence or any other value blocks review/export. Runtime `graph-overlay.json.card_order` is exported only from this resolver. Existing disagreements in `1-1`, `4-2`, and `5-2` must be made exactly equal before review/export can pass; review cannot waive them.

The overlay revision byte contract serializes the exact declared object with RFC 8785 JSON Canonicalization Scheme, encodes those canonical characters as UTF-8 without BOM, and lowercase-hex SHA-256 hashes those bytes. No undeclared field may enter the revision.

`overlayRevision` hashes exactly `{ "cardOrder": string[], "lessonId": string, "links": NormalizedLink[] }`. Each link has exactly `{ "normalizedType": string, "relationId": string, "sourceId": string, "strength": number|null, "targetId": string }`, where missing id is `""` and missing/non-finite strength is `null`. Before JCS, links sort by `(sourceId, targetId, normalizedType, relationId, strengthKind, strengthValue)`, where `strengthKind=0,strengthValue=0` for `null` and `strengthKind=1,strengthValue=strength` for finite numbers; `cardOrder` preserves teaching order. Python review/export and the TypeScript runtime loader share golden canonical-byte and digest vectors containing Chinese text, missing id, `null`, negative, zero, `1.0`, and reordered links with equal prefixes. Missing or invalid input returns `lessonContext: null`, clears stale client lesson state, and never guesses another lesson.

Node membership, shared knowledge coverage, or overlay presence must not infer an active lesson. With no valid explicit lesson, lesson ordering is skipped. With one, the projection reads only `course-content/runtime/lessons/<activeLessonId>/graph-overlay.json.card_order`; it must not call the runtime-catalog fallback to `lesson.json.card_order`, `lesson.json.sequence.card_order`, another lesson, or an authoring artifact. URL lesson change, route lifecycle change, invalidation, or clearing recalculates the projection and layout. `card_order` can only position canonical nodes. Overlay `links` never create graph edges: an overlay link may reference a visible edge only when its source id, target id, and normalized relation type exactly match an authored canonical relation in the active graph version. Reverse, missing, ambiguous, stale, synthetic, or non-canonical matches are reported as overlay gaps and never render or animate. This applies to every runtime overlay, including `1-1`, `2-1`, `2-2`, `2-3`, and `cruise-comfort-boppps`.

The layout will:

1. resolve available teaching-order sources and build the directed post-requisite subgraph;
2. condense strongly connected components so cycles are explicit but do not break ordering;
3. compute deterministic topological depth and stable tie-breaks;
4. assign increasing radius along an Archimedean spiral so earlier concepts remain nearer the domain center;
5. relax angle and spacing within bounded depth bands using node and wrapped-label collision bounds;
6. place nodes without any reviewed teaching-order source in a bounded region labeled `尚无可验证的先后关系` without fabricating order.

Association and child edges do not pull nodes or define depth. The spiral is a positioning scaffold and is never painted. User-positioned coordinates remain authoritative until explicit relayout or domain change makes them inapplicable.

A free force simulation was rejected because it cannot guarantee readable learning order. A strict linear path was rejected because branching prerequisites and independent concepts require two-dimensional space.

### 5. Share one edge geometry model between static and animated rendering

The renderer will calculate source and target intersections with the actual node shape and presentation radius. A single visual relation uses a straight segment. Parallel or reciprocal relations receive deterministic signed quadratic curvature. Edges render below nodes and labels.

Post-requisite and visible child edges place one static arrowhead at the target boundary. Associations use a restrained dashed undirected line. Static edge painting, hit testing, endpoint arrows, and motion markers consume the same path descriptor and point/tangent evaluators.

This prevents center-crossing lines, arrowheads hidden beneath nodes, and animated markers drifting away from curves.

### 6. Focus a bounded learning-path corridor instead of enumerating paths

Selecting a knowledge node derives a focused corridor only from authored canonical post-requisite edges: at most four ancestor levels, the selected node, at most four descendant levels, 64 corridor nodes, and 96 corridor edges, using strength then stable id to resolve caps. At most three motion markers run concurrently; shared segments count once. The corridor can branch, converge, and cross domain boundaries in canonical data, but the canvas highlights only its active-domain segment and the inspector offers explicit navigation to an adjacent hidden-domain node.

Persisted personalized `LearningPath`, ResourceNode path eligibility, and ResourceNode-to-knowledge mapping are deliberately outside this change. They require an independent authorization, versioning, governance, and privacy contract and must not be inferred or partially consumed by this graph UI. This proposal's “learning path” means a readable route through canonical post-requisite relations, not a persisted recommendation artifact.

Graph selection, focus, and navigation are read-only presentation. They never mark a learning step complete, satisfy a prerequisite, or imply teacher progression; those states remain owned by durable learning-evidence and classroom contracts.

Focused nodes and edges intensify while unrelated content dims but remains orienting. Shared route segments are represented once. A small directional arrow travels from the source boundary along the exact straight or curved edge, follows the local tangent, disappears at the target boundary, pauses, and restarts at the source. Motion renders beneath nodes so endpoint occlusion is natural. It becomes prominent only for the selected corridor.

With `prefers-reduced-motion: reduce`, looping markers and interpolation stop; static edge emphasis and target arrowheads preserve order.

### 7. Decouple selection, inspection, and navigation

`selectedNodeId`, `inspectorOpen`, and `navigationState` will be independent state. Activating a knowledge node opens or updates the inspector regardless of whether data had to be progressively resolved. Activating a domain changes navigation and may inspect the domain summary, but it does not use inspector closure as an expansion signal. Blank-canvas activation may dismiss the inspector without leaving the domain or altering layout.

When a user manually changes domains while an inspector targets a node outside the destination domain, the transition clears that node selection and focused corridor before materializing the destination; the inspector either closes or atomically replaces content with the destination domain summary. It never retains an inspector or corridor for a hidden old-domain node. Cross-domain relation navigation is distinct: it transitions first, then selects and inspects the explicit target node in the destination domain.

Async node detail responses continue to be owner-checked so stale responses cannot replace the current selection. Cross-domain related items perform an explicit domain transition before selecting their target.

### 8. Overlay wrapped labels on bounded nodes

2D and 3D renderers will use a shared label layout policy with a larger platform-appropriate base size, centered wrapping, a bounded line count, and a maximum text width that may slightly exceed the node body. Node radius remains bounded by instructional importance rather than title length. Label bounds participate in layout collision and visual acceptance.

### 9. Preserve progressive loading and renderer parity

Root and expansion shard APIs remain the data source. Entering a domain requests or reuses the domain root's expansion shard and then materializes only that domain's visible members. Dense remaining shards stay outside normal first render.

2D is the default learning-path view. 3D receives the same navigation subset, relation projection, focus corridor, endpoint direction, label policy, and reduced-motion policy; domain nodes may remain coplanar to preserve learning order. If a renderer cannot express an exact dash pattern, it must preserve family, direction, emphasis, and endpoint semantics rather than reverting to raw relation particles.

Representative acceptance uses a checked-in fixture generated from the largest reviewed runtime domain and records its graph-version hash. Chromium runs at a 1440×900 CSS-pixel viewport, device scale factor 1, without CPU throttling on the project reference desktop. After a two-second warm-up and initial fit, node-body intersection count must be zero. Label overlap ratio is `unique intersecting visible-label pairs / visible rendered label count` and must not exceed 0.05; lower-priority labels may defer rather than overlap. Focus motion is sampled from `requestAnimationFrame` intervals for ten seconds after warm-up, must maintain at most three simultaneous markers, and must have a 95th-percentile frame duration below 24 ms with no graph-attributable PerformanceObserver long task above 100 ms. The test records browser version, fixture hash, hardware identifier, raw samples, and formulas. These thresholds are acceptance gates, not adaptive production constants.

## Risks / Trade-offs

- **Authored relation direction is inconsistent** → Centralize normalization, test every raw runtime type, and fail coverage when a directional type lacks an explicit rule.
- **Cycles make “first” and “later” ambiguous** → Condense strongly connected components and present members within the same depth band.
- **Many isolated concepts crowd the unsequenced region** → Apply bounded packing and expose an honest unsequenced status rather than manufacturing prerequisites.
- **Focused ancestry or descendants can still be large** → Cap corridor depth and edge count with stable ranking and never enumerate all simple paths.
- **Moving arrows can create noise or consume frame time** → Animate only focused post-requisite edges, deduplicate shared segments, cap concurrent markers at three, and suspend when hidden or reduced motion is active.
- **Simplified relation families can appear to lose meaning** → Preserve and expose every raw relation, rationale, strength, and source in the inspector and diagnostics.
- **A single-domain view can hide cross-domain context** → List cross-domain associations in the inspector with explicit navigation to the owning domain.
- **Changing activation semantics can break deep links and keyboard flows** → Route graph, directory, inspector, search, and semantic-node activation through one navigation-aware resolver and test pointer and keyboard parity.

## Migration Plan

1. Add projection, geometry, path-corridor, and layout helpers with unit coverage while retaining current rendering behind the existing workspace boundary.
2. Introduce root/domain navigation and adapt progressive shard materialization.
3. Replace relation controls and renderers with three-family presentation, boundary clipping, wrapped labels, and focused motion.
4. Decouple and verify inspector state, cross-domain navigation, keyboard focus, mobile sheets, and assistant context.
5. Validate representative runtime graph data, 2D/3D parity, reduced motion, performance, light/dark desktop, and narrow viewports.
6. The PostgreSQL projection migration removes the endpoint-pair unique constraint and adds relation metadata, strength, and endpoint indexes. Historical rows have unknown ownership and remain unowned; migration never infers ownership from endpoint nodes. Canonical seed claims exact canonical relation IDs and stale cleanup affects only rows carrying the current relation `runtimeSource`.
7. Root, progressive, and detail loading execute the same complete strict relation contract before returning any node. Missing, malformed, empty, unknown, duplicate, reverse-child, or unresolved relation input blocks the response with bounded machine-readable diagnostics.
8. This schema change is not directly reversible while duplicate endpoint pairs exist. A downgrade requires a backup, an explicit product decision about which relations to archive or collapse, a duplicate-pair preflight query, and only then restoration of the old unique constraint. The isolated PostgreSQL test exercises this rejection condition rather than claiming a lossless automatic rollback.
9. Canonical file fallback distinguishes absence from invalidity. Only `ENOENT` for a canonical file permits DB fallback; malformed, empty, duplicate, whitespace, or overlong node identity is a fail-closed loading diagnostic. File cache reuse requires a fresh stable size/mtime/SHA-256 fingerprint of both node and relation files on every request, so invalid mutations cannot be hidden by the TTL.
10. DB validation reads every relation carrying the current canonical relation `runtimeSource` before endpoint validation, without active-node joins. The endpoint set contains only active nodes carrying the canonical node source marker; therefore runtime-owned relations to inactive or external nodes produce the same unresolved-endpoint 422 as file input. Public node listing, including legacy `source=db`, uses the runtime loader and sanitized node DTO rather than a raw Prisma escape path.
11. A DB fallback payload is assembled inside one Prisma `RepeatableRead` transaction. Canonical runtime nodes are read first, then all runtime-owned relations and their count/fingerprint evidence are read from that same transaction snapshot; root, full, progressive, list, and detail consumers receive only the resulting payload and never issue a second version query. A bounded retry handles transient snapshot conflicts. The isolated PostgreSQL test commits a same-count node/relation content update between reads and requires one payload/digest to remain wholly old while the next request and shard version switch wholly new.
12. Runtime lesson/media governance compares each reviewed source, manifest, and evidence hash with the current file hash. Any mismatch changes only that item to `pending-rereview`, records the stale reason and both reviewed/current hashes, and projects it as stale without path eligibility. It never rewrites human reviewer decisions or substitutes a current hash as human-confirmed. Source, review-item, workqueue, audit, and projection summaries are derived from item state; no lesson key or handout sentinel propagates invalidation. A reviewed resource that disappears may remain only as a pending workqueue tombstone, while a missing human-confirmed resource blocks generation. Repeated generation over unchanged inputs must produce identical bytes even when pending review causes a non-success governance result.

## Open Questions

None. Any new runtime relation type, inverse alias, or change to the quantitative acceptance limits requires a reviewed contract update rather than implementation-time inference.
