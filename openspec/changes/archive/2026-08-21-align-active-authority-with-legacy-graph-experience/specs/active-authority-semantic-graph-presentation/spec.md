## ADDED Requirements

### Requirement: New graph follows the established legacy graph interaction contract
The active Authority product view SHALL use the established old-graph interaction contract for the full workspace canvas, compact typed node glyphs, external node labels, relation emphasis, pan, zoom, focus return, and stable inspection. Sharing that presentation contract MUST NOT combine active Authority and old graph API responses, nodes, relations, selection state, or cached data.

#### Scenario: User enters a new graph domain
- **WHEN** the new graph renders a bounded domain subgraph
- **THEN** the graph canvas SHALL occupy the available workspace and support the same primary pan, zoom, selection, focus, and filter interactions as the old graph
- **AND** the active view SHALL continue to use only active Authority shard data

#### Scenario: User switches between graph versions
- **WHEN** the user switches from one graph version to the other
- **THEN** the destination SHALL initialize from its own API and interaction state
- **AND** no node, relation, viewport, detail, or cached response from the previous version SHALL be merged into it

### Requirement: New graph nodes use compact glyphs with external readable labels
Ordinary active Authority nodes SHALL use their registered shape, color, and accessible description to communicate type. The visible semantic name SHALL appear below the glyph with bounded multiline wrapping, and the canonical type label SHALL NOT be repeated as visible text inside the glyph.

#### Scenario: Ordinary node renders
- **WHEN** a presentable Authority object enters the domain canvas
- **THEN** its compact glyph SHALL encode the registered type and its complete bounded semantic label SHALL render below the glyph
- **AND** no visible type caption SHALL occupy the glyph interior

#### Scenario: Node name exceeds one line
- **WHEN** the semantic name does not fit the approved single-line label width
- **THEN** the label SHALL wrap across the bounded number of lines without an arbitrary character slice
- **AND** it SHALL remain readable without overlapping its own glyph or an immediately adjacent label at the accepted layout bounds

### Requirement: Product graph version names hide internal implementation titles
The ordinary graph-version switch SHALL label the active Authority product view as `新版` and the historical Legacy product view as `旧版`. Internal `Authority` and `Legacy` names SHALL remain confined to API names, diagnostics, test hooks, and logs and MUST NOT appear as the ordinary switch labels or their accessible names.

#### Scenario: Ordinary user reads the graph switch
- **WHEN** the knowledge workspace renders its product graph-version controls
- **THEN** the two ordinary options SHALL be named `新版` and `旧版`
- **AND** internal Authority or Legacy names SHALL not be exposed by visible or accessible control text

#### Scenario: Administrator opens candidate diagnostics
- **WHEN** an authorized administrator opens the independent candidate diagnostic mode
- **THEN** any explicit diagnostic identity SHALL remain confined to that controlled surface
- **AND** it SHALL not become a third ordinary version name or alter the `新版` and `旧版` meanings

### Requirement: Active Authority mathematical expressions use the governed LaTeX renderer
Every user-visible mathematical expression supplied through a trusted Formula or governed knowledge-content field SHALL be rendered through the existing LaTeX/KaTeX presentation contract. Arbitrary prose MUST NOT be guessed to be TeX, and a math-rendering failure MUST produce a bounded Chinese unavailable state without exposing internal source values.

#### Scenario: Formula node detail contains a reviewed expression
- **WHEN** the selected Authority Formula supplies trusted mathematical content
- **THEN** the expression SHALL render as formatted mathematics through the governed LaTeX renderer
- **AND** the same expression SHALL not be presented as an unprocessed command string

#### Scenario: Knowledge content contains declared math blocks
- **WHEN** a governed Knowledge Card contains declared inline or block mathematical nodes
- **THEN** each node SHALL use the same LaTeX rendering contract
- **AND** surrounding prose SHALL remain ordinary escaped text or governed Markdown
