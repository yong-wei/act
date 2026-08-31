## MODIFIED Requirements

### Requirement: Active Authority mathematical expressions use the governed LaTeX renderer
Every user-visible mathematical expression supplied through qualified Authority rich text, a trusted Formula field, or governed Knowledge Card content SHALL use the shared LaTeX/KaTeX presentation contract. Formulaized node titles SHALL render as governed mathematics in 2D, 3D, hover and keyboard preview, search and filter results, accessibility projections, and inspector titles. Descriptions and card content SHALL preserve published inline or block display semantics. Arbitrary prose MUST NOT be guessed to be TeX. An Authority sidecar math-rendering failure MUST preserve neighboring text and use its reviewed bounded unavailable state without exposing raw source values; an unregistered Authority failure MUST block target product qualification. An ACT-authored Markdown formula failure MUST block that content's formal publication until its content or shared renderer compatibility is repaired and MUST NOT inherit an Authority disposition.

#### Scenario: Formulaized title appears across graph surfaces
- **WHEN** a presentable Authority node has a qualified title containing inline math spans
- **THEN** its 2D and 3D labels, preview, search result, accessible name, and inspector title SHALL present the same governed text-and-math sequence
- **AND** no surface SHALL replace the math span with raw TeX, a plain-text approximation, or a separately parsed label

#### Scenario: Graph zoom changes label visibility
- **WHEN** zoom level or node density causes ordinary titles to hide or reappear
- **THEN** formula and non-formula portions of the same title SHALL hide and reappear together under the same level-of-detail rule
- **AND** formula content SHALL NOT have a separate visibility threshold

#### Scenario: Formula node detail contains a reviewed expression
- **WHEN** the selected Authority Formula supplies trusted mathematical content
- **THEN** the expression SHALL render as formatted mathematics through the shared governed renderer with current-locale accessibility
- **AND** an explicit valid-formula copy action SHALL return trusted delimiter-free LaTeX rather than rendered HTML

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
