## ADDED Requirements

### Requirement: Knowledge graph direct manipulation visual QA verifies interaction and spatial stability
Commercial UI governance SHALL require browser, coordinate, motion, accessibility, and visual evidence for knowledge-graph direct activation, sector expansion, inspector behavior, and drag stability.

#### Scenario: Direct node activation is reviewed
- **WHEN** a PR changes `/knowledge` node activation, expandability metadata, expansion loading, or leaf inspection behavior
- **THEN** evidence SHALL show an expandable node expanding from one pointer activation, the same node collapsing from one activation, and a leaf node opening the inspector without an expansion request
- **AND** keyboard evidence SHALL prove that Enter or Space invokes the same outcomes with visible focus and honest busy or error states.

#### Scenario: Sector expansion is reviewed
- **WHEN** a PR changes focused expansion layout
- **THEN** evidence SHALL show outward sector placement for nodes with and without first-reveal layout provenance, additional arcs for larger neighborhoods, and preserved coordinates for already visible or user-positioned nodes
- **AND** complete-ring cross/star layouts, stretched distant edge fans, duplicated neighbors, and unsolicited full-graph fit-to-view SHALL be blocking regressions.

#### Scenario: Drag stability is reviewed
- **WHEN** a PR changes graph layout or drag handling
- **THEN** automated evidence SHALL record coordinates before, during, and after a node drag and prove that only the dragged node changed
- **AND** visual evidence SHALL show that initial layout is stable after engine completion and ordinary interaction does not reheat or redistribute the graph.

#### Scenario: Inspector behavior is reviewed
- **WHEN** a PR changes graph node selection or inspector content
- **THEN** evidence SHALL show leaf activation opening the inspector, Knowledge Card appearing before Related Knowledge Points, and blank-space activation, canvas drag start, and node drag start dismissing the inspector
- **AND** dismissal SHALL preserve expanded neighborhoods, cached shards, viewport state, and node coordinates.

#### Scenario: Expansion motion is reviewed
- **WHEN** a PR adds or changes graph focus, relation, node reveal, collapse, or camera transitions
- **THEN** evidence SHALL show bounded one-shot motion that clarifies the expanded origin, finishes promptly, and does not continue drifting or pulsing
- **AND** a reduced-motion run SHALL prove immediate equivalent state, readable focus, and no required spatial animation.

#### Scenario: Cross-surface graph evidence is reviewed
- **WHEN** direct-manipulation evidence is submitted for acceptance
- **THEN** it SHALL cover 2D and 3D modes, light and dark themes, desktop and narrow viewports, inspector and local-tool collision states, and the shared Konling dock
- **AND** screenshots that only prove the graph rendered SHALL NOT satisfy the interaction acceptance gate.

## MODIFIED Requirements

### Requirement: Knowledge graph progressive loading evidence is required
Commercial UI governance SHALL verify that knowledge-graph first render, direct node activation, filtered-empty behavior, and background loading match the progressive graph-loading contract.

#### Scenario: Knowledge graph first-render evidence is captured
- **WHEN** `/knowledge` visual or browser evidence is produced
- **THEN** evidence SHALL show top-level collapsed graph roots visible before any full graph payload is requested, parsed, or completed
- **AND** evidence SHALL include root count, graph version, first-screen payload identity, expandability descriptors, and whether the full graph endpoint was avoided during first render
- **AND** evidence SHALL cover 1440px, 1279px, 1100px, 1024px, and 320px viewports.

#### Scenario: Direct node expansion evidence is captured
- **WHEN** `/knowledge` expansion behavior is reviewed
- **THEN** evidence SHALL show one activation expanding a collapsed expandable node, a pending local loading state when data is missing, and one activation collapsing the expanded node
- **AND** the evidence SHALL show that collapsing hides the revealed neighborhood without clearing the cache or losing node activation focus
- **AND** the evidence SHALL show pointer and keyboard parity, accessible expanded and busy state, duplicate activation suppression, and focus continuity after asynchronous expansion.

#### Scenario: Leaf activation evidence is captured
- **WHEN** `/knowledge` node activation behavior is reviewed
- **THEN** evidence SHALL show a canonical leaf opening the inspector without requesting an expansion shard
- **AND** it SHALL show that unknown metadata resolves from canonical expansion evidence before the UI chooses leaf inspection or expansion.

#### Scenario: Filtered-empty expansion evidence is captured
- **WHEN** `/knowledge` expansion behavior is reviewed under a filter that hides all neighbors for a canonically expandable node
- **THEN** evidence SHALL show a visible local filtered-out explanation while the node remains logically expanded and its shard remains cached
- **AND** the evidence SHALL distinguish filtered-empty from canonical leaf, loading, and network failure
- **AND** changing filters SHALL reveal matching cached neighbors without a duplicate request, while activating the filtered-empty node again SHALL collapse it.

#### Scenario: Background loading evidence is captured
- **WHEN** progressive graph loading is reviewed
- **THEN** evidence SHALL show active-filter shards loading after first paint and remaining graph shards loading only after root rendering is usable
- **AND** evidence SHALL prove that panning, node activation, local tools, and Konling entry remain usable while background loading proceeds
- **AND** evidence SHALL include structured overlap or bounding-rectangle checks for opened local graph tools, selected-node inspector, expanded Konling, floating dock, and expansion loading state
- **AND** evidence SHALL show focus return, dock avoidance, and activation-context retention while background parsing and merging proceed.

## REMOVED Requirements

### Requirement: Knowledge graph expansion visual QA verifies local controls and centered layout
**Reason**: The previous gate is tied to the removed node-local expansion button and complete-ring centered layout, so it would validate the interaction being replaced.

**Migration**: Use the direct-manipulation gate, which verifies single-activation branching, explicit expandability, outward sector placement, stable coordinates, inspector order and dismissal, bounded motion, reduced motion, and cross-surface parity.
