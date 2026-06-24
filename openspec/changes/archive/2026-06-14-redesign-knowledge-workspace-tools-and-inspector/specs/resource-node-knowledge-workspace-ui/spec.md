## ADDED Requirements

### Requirement: Knowledge graph local tools use a compact command system
The knowledge workspace SHALL expose graph-specific directory, filter, legend, view, layout, and focus controls through a coherent compact local command system.

#### Scenario: Desktop knowledge graph opens
- **WHEN** `/knowledge` renders on a desktop viewport
- **THEN** chapter directory, relation filters, relation legend, view mode, layout, and focus controls SHALL appear as compact local workspace tools by default
- **AND** detailed panels SHALL open only when requested by the user.

#### Scenario: Local tools are collapsed
- **WHEN** local graph tools are closed or compacted
- **THEN** active relation count, density, strength, connected-node mode, and selected focus summaries SHALL remain visible where relevant
- **AND** the graph canvas SHALL remain the primary visual surface.

#### Scenario: User opens a local tool
- **WHEN** the user opens directory, filters, legend, view, layout, or focus controls
- **THEN** the tool SHALL preserve selected node, graph density, active filters, pinned layout state, and inspector context
- **AND** the tool SHALL not overlap the shared floating dock or global navigation.
- **AND** keyboard focus SHALL enter and leave the opened tool predictably, Escape or an equivalent close action SHALL close the tool where appropriate, and focus SHALL return to the invoking control.

### Requirement: Selected knowledge nodes render in a stable inspector
The knowledge workspace SHALL present selected-node content through a stable inspector hierarchy rather than a cramped content overlay.

#### Scenario: User selects a knowledge node on desktop
- **WHEN** a selected knowledge node has details, infograph, relations, learning actions, or evidence sources
- **THEN** the UI SHALL render a stable inspector with clear hierarchy for those sections
- **AND** the inspector SHALL use predictable desktop width or overlay rules that do not cause graph layout jitter.

#### Scenario: User changes selected node
- **WHEN** the selected node changes
- **THEN** inspector content SHALL update without remounting the whole panel or losing stable scroll and layout context unnecessarily
- **AND** stale async detail responses SHALL NOT overwrite the current selected-node content.

#### Scenario: Inspector content updates asynchronously
- **WHEN** details, infograph metadata, relations, or evidence sources load for the current selected node
- **THEN** async updates SHALL preserve the user's active inspector section and scroll context where possible
- **AND** they SHALL NOT reset reading position solely because data returned after the panel opened.

#### Scenario: Mobile knowledge graph opens a node
- **WHEN** a selected node is opened on a mobile viewport
- **THEN** node details SHALL render through a drawer or sheet pattern
- **AND** graph pan, zoom, and local tool access SHALL remain reachable when the sheet is collapsed.
- **AND** keyboard and screen-reader focus SHALL remain inside the opened sheet while active and return to the invoking graph context when closed.
