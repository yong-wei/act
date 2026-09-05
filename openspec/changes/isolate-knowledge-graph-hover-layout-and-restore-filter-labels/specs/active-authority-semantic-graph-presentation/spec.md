## MODIFIED Requirements

### Requirement: Active Authority mathematical expressions use the governed LaTeX renderer
Every user-visible mathematical expression supplied through qualified Authority rich text, a trusted Formula field, or governed Knowledge Card content SHALL use the shared LaTeX/KaTeX presentation contract. Formulaized node titles SHALL render as governed mathematics in 2D, 3D, hover and keyboard preview, search and filter results, accessibility projections, and inspector titles. Descriptions and card content SHALL preserve published inline or block display semantics. Arbitrary prose MUST NOT be guessed to be TeX. An Authority sidecar math-rendering failure MUST preserve neighboring text and use its reviewed bounded unavailable state without exposing raw source values; an unregistered Authority failure MUST block target product qualification. An ACT-authored Markdown formula failure MUST block that content's formal publication until its content or shared renderer compatibility is repaired and MUST NOT inherit an Authority disposition. Visible inspector and card surfaces MUST NOT offer a 「复制公式」 or 「复制全文」 control.

#### Scenario: Formulaized title appears across graph surfaces
- **WHEN** a presentable Authority node has a qualified title containing inline math spans
- **THEN** its 2D and 3D labels, preview, search result, accessible name, and inspector title SHALL present the same governed text-and-math sequence
- **AND** no surface SHALL replace the math span with raw TeX, a plain-text approximation, or a separately parsed label

#### Scenario: Graph zoom changes label visibility
- **WHEN** a label budget defers some ordinary titles
- **THEN** formula and non-formula portions of the same title SHALL hide and reappear together under the same budget
- **AND** formula content SHALL NOT have a separate visibility threshold

#### Scenario: Formula node detail contains a reviewed expression
- **WHEN** the selected Authority Formula supplies trusted mathematical content
- **THEN** the expression SHALL render as formatted mathematics through the shared governed renderer with current-locale accessibility
- **AND** the inspector SHALL NOT render a copy-formula button

#### Scenario: Knowledge content contains declared math blocks
- **WHEN** a governed Knowledge Card contains declared inline or block mathematical nodes
- **THEN** each node SHALL use the shared LaTeX rendering and macro contract while the card remains Markdown-authored
- **AND** surrounding prose SHALL remain ordinary escaped text or governed Markdown

#### Scenario: Knowledge Card formula cannot render
- **WHEN** an ACT-authored Knowledge Card formula fails shared syntax, macro, safety, or rendering validation
- **THEN** the card SHALL remain development-only until the content or shared renderer compatibility is repaired
- **AND** the failure SHALL NOT receive or reuse an ActKG Authority unavailable disposition

#### Scenario: Registered formula is unavailable
- **WHEN** a math span has a matching course-owner-approved unavailable disposition
- **THEN** only that span SHALL use its safe fallback while neighboring text and unrelated detail remain available
- **AND** a title that no longer has meaningful governed identity SHALL follow the unavailable-name review contract

### Requirement: Active node hover provides a bounded non-destructive preview
Hovering or keyboard-previewing a presentable active node SHALL expose its human-readable name, registered type, short explanation, and bounded availability summary without changing selection, layout of other nodes, camera, viewport zoom, filters, or drawer state. The hovered node's glyph MAY enlarge. Hover preview SHALL NOT load long-form content or replace keyboard-accessible selection.

#### Scenario: Viewer hovers a node
- **WHEN** a pointer rests on a presentable active node
- **THEN** a rapid bounded preview SHALL appear using already available safe fields
- **AND** the camera and every other node SHALL keep their current transform
- **AND** leaving the node SHALL dismiss the preview without opening or changing the selected-node drawer

#### Scenario: Keyboard user explores a node
- **WHEN** a keyboard user focuses a semantic node
- **THEN** equivalent bounded preview information SHALL be available through the accessible interaction contract
- **AND** explicit activation SHALL remain the action that opens the detail drawer

### Requirement: Domain concept labels are readable before selection
The bounded domain overview SHALL present governed names of ordinary DomainConcept nodes without requiring selection or hover. Visible canvas labels SHALL remain on after camera fit, up to an explicit maximum count that prefers labels nearest the viewport center after selected and hovered nodes. Collision MAY defer labels beyond that budget while preserving accessible names. Ordinary labels SHALL NOT be hidden solely because projected font size falls below a zoom threshold.

#### Scenario: Domain overview becomes usable
- **WHEN** the force layout reaches its accepted settlement milestone
- **THEN** labels nearest the viewport center SHALL be visible up to the configured maximum
- **AND** ordinary labels SHALL not be reduced to selected-only or hovered-only presentation

#### Scenario: Far camera still shows labels
- **WHEN** the viewer zooms out below the previous readable-font threshold
- **THEN** the center-priority budget SHALL still paint labels
- **AND** hover SHALL NOT trigger a camera fit to keep those labels readable

#### Scenario: Density prevents one label
- **WHEN** one label cannot fit after force separation, camera fitting and the maximum visible count
- **THEN** the policy MAY defer that label while preserving its accessible name
- **AND** the evidence SHALL record the deferred count against the accepted budget
