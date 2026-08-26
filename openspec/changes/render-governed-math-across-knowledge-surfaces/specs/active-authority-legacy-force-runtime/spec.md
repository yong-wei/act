## ADDED Requirements

### Requirement: Shared Force Graph anchors governed semantic labels
The established Force Graph runtime SHALL provide one source-neutral semantic label layer for qualified active rich titles in both 2D and 3D. The label layer SHALL consume the active adapter's presentation model, remain anchored to Force Graph coordinates, and preserve the existing topology, layout, selection, hit testing, camera, and mode-state ownership. It MUST NOT create a second graph engine, duplicate node identity, or execute rich-text parsing and KaTeX during coordinate-only animation updates.

#### Scenario: Active node title contains mathematics in 2D
- **WHEN** a qualified active rich title becomes visible at the ordinary 2D label level
- **THEN** the semantic label layer SHALL render its complete bounded text-and-math sequence below the governed glyph
- **AND** Force Graph SHALL retain node geometry, dragging, pinning, selection, and edge ownership

#### Scenario: User switches the same active view to 3D
- **WHEN** an active rich title is visible after switching from 2D to 3D
- **THEN** 3D SHALL use the same rich-title model, wrapping bounds, locale, and accessible name
- **AND** the dimension change SHALL NOT reinterpret math, fetch old graph data, or create a second selected node

#### Scenario: Force coordinates update
- **WHEN** force simulation or camera movement changes label screen coordinates
- **THEN** the runtime SHALL update only label placement and ordinary visibility state from cached content
- **AND** it SHALL NOT rerun KaTeX solely because the node moved

### Requirement: Legacy math compatibility remains explicit and bounded
Legacy mode SHALL send only its existing explicit formula fields through the shared mathematics renderer. Legacy names, descriptions, hover text, and other ordinary strings MUST remain text and MUST NOT be scanned for delimiters or TeX commands. A Legacy explicit-formula failure SHALL use the same bounded unavailable behavior and MUST NOT echo raw TeX.

#### Scenario: Legacy detail contains an explicit formula field
- **WHEN** the old graph inspector receives an existing explicit reviewed formula field
- **THEN** it SHALL render through the shared mathematics configuration
- **AND** old and active graph data, caches, selections, and identities SHALL remain isolated

#### Scenario: Legacy title resembles TeX
- **WHEN** an ordinary Legacy title or description contains `$`, a backslash command, or mathematical punctuation
- **THEN** it SHALL remain ordinary escaped text
- **AND** the runtime SHALL NOT infer or persist a mathematics span
