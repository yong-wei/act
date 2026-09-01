# governed-rich-text-math-presentation Specification

## Purpose
TBD - created by archiving change render-governed-math-across-knowledge-surfaces. Update Purpose after archive.
## Requirements
### Requirement: Authority rich text closes over one immutable release
The system SHALL accept a governed rich-text document only when its readiness manifest, localized document, Formula or Typed Math Fragment references, macro profile, content hashes, and locale all close over the same selected Authority release. The server MUST recompute declared digests and reference closure before projecting the document and MUST NOT resolve a missing asset from another release, global registry, ACT-authored replacement, or client cache.

#### Scenario: Rich-text document and math assets match
- **WHEN** a selected Authority release contains a qualified localized document whose every math span references a same-release qualified asset
- **THEN** the server SHALL admit the document as available governed rich text
- **AND** its ordered text and math spans SHALL remain bound to that release and locale

#### Scenario: Math reference crosses a release boundary
- **WHEN** a rich-text document references a missing, duplicate, hash-drifted, unsafe, or different-release math asset
- **THEN** qualification SHALL fail closed for that document or span according to its reviewed disposition
- **AND** the system SHALL NOT search another release or reinterpret the source string

### Requirement: Governed rich text preserves explicit text and math boundaries
The presentation adapter SHALL preserve the published paragraph, math-block, text-span, math-span, display-mode, and math-slot order. Ordinary strings MUST remain escaped text and MUST NOT be promoted to mathematics by scanning delimiters, TeX commands, symbols, Greek characters, equations, or canonical type names.

#### Scenario: Paragraph contains inline mathematics
- **WHEN** an available localized paragraph contains ordered text and inline math spans
- **THEN** the presentation model SHALL retain the same order and inline display semantics
- **AND** surrounding prose SHALL remain ordinary text rather than a reconstructed Markdown string

#### Scenario: Plain fallback contains historical delimiters
- **WHEN** a source or fallback string contains `$`, `$$`, `\\(`, `\\)`, or another historical delimiter outside a qualified math span
- **THEN** the adapter SHALL preserve it as text for compatibility
- **AND** it SHALL NOT parse the delimiter at runtime

### Requirement: All knowledge surfaces share one governed mathematics configuration
Graph rich text, explicit Formula fields, Knowledge Card Markdown, textbook Markdown, and handout Markdown SHALL obtain KaTeX security options and admitted macro profiles from one versioned shared configuration. Rendering MUST use strict failure, `trust=false`, bounded input, explicit display mode, and HTML+MathML output. A consumer MUST NOT add private macro aliases or rewrite LaTeX to make a formula pass.

#### Scenario: ActKG publishes a supported macro profile
- **WHEN** an admitted math asset references a versioned macro profile supported by the shared registry
- **THEN** every affected graph and Markdown consumer SHALL render it with the same macro definitions and security settings
- **AND** the graph adapter SHALL NOT maintain a second macro table

#### Scenario: Macro profile is not supported
- **WHEN** an otherwise qualified formula references a macro profile not supported by the shared registry
- **THEN** the formula SHALL enter the governed unavailable workflow until shared compatibility is added and verified
- **AND** no consumer SHALL silently substitute or strip the macro

### Requirement: Valid mathematics provides visual, accessible, search and copy projections
Every renderable math span SHALL have formatted visual output, a current-locale accessible math label, searchable governed text, and an explicit copy projection. Whole-content copy SHALL use the deterministic plain-text fallback; single-formula copy SHALL use trusted delimiter-free LaTeX and MUST NOT copy rendered HTML. An unavailable formula MUST NOT expose a LaTeX copy action.

#### Scenario: User reads and copies a valid formula
- **WHEN** a renderable formula appears in a detail surface or Knowledge Card
- **THEN** the user SHALL receive formatted mathematics and one non-duplicated accessible math description
- **AND** an explicit formula-copy action SHALL return the trusted delimiter-free LaTeX

#### Scenario: Search matches mathematical content
- **WHEN** a user searches using governed source text, a current-locale accessible label, or an approved symbol name
- **THEN** matching rich-text content SHALL be discoverable without treating raw LaTeX commands as default natural-language terms
- **AND** the result SHALL display the governed rich title rather than a command string

### Requirement: Authority sidecar formula failures have complete reviewed dispositions
For a target Authority product qualification, every user-reachable ActKG sidecar math span SHALL be either `RENDERABLE` or `REGISTERED_UNAVAILABLE`. A registered unavailable disposition MUST bind the exact Authority, document or field, math asset, content hash, failure reason, safe current-locale fallback, affected surfaces, and course-owner review. Any unregistered Authority failure, missing row, duplicate row, or identity drift MUST block product qualification. ACT-authored Knowledge Card, textbook, and handout Markdown formulas are outside this disposition ledger; any failure in such content MUST block its formal publication until the content or shared rendering compatibility is repaired.

#### Scenario: Course owner registers an unavailable formula
- **WHEN** a formula cannot render and the course owner approves a complete version-bound unavailable record during repository development
- **THEN** the product MAY preserve neighboring text and display the approved safe fallback or bounded unavailable state
- **AND** the record SHALL appear in the upstream repair report for the next ActKG version

#### Scenario: Failure is not registered
- **WHEN** a target product surface encounters a math failure without a current matching disposition
- **THEN** Authority product qualification SHALL fail
- **AND** runtime rendering SHALL NOT create an automatic waiver

#### Scenario: ACT-authored Markdown formula fails
- **WHEN** a Knowledge Card, textbook, or handout formula fails shared syntax, macro, safety, or rendering validation
- **THEN** that content SHALL fail formal publication until repaired
- **AND** the failure SHALL NOT be inserted into the ActKG upstream repair report or matched to an Authority disposition

#### Scenario: Governance artifacts are packaged
- **WHEN** application, public assets, Runtime Release, or deployment output is assembled
- **THEN** review decisions, raw failure payloads, and upstream repair packages SHALL be absent from the runtime bundle
- **AND** no runtime role, API, route, or control SHALL expose formula approval operations

### Requirement: Rich-text rendering is content-addressed and animation-safe
Resolved rich text and math presentation results SHALL be cached by immutable Authority, locale, content, macro-profile, display-mode, theme, and relevant density identity. Force Graph animation MAY update label coordinates and visibility, but MUST NOT repeat rich-text parsing or KaTeX execution on each animation frame.

#### Scenario: Force layout continues after labels render
- **WHEN** visible 2D or 3D nodes move during force simulation or camera interaction
- **THEN** the label layer SHALL update placement from cached presentation results
- **AND** it SHALL NOT recreate mathematical markup solely because coordinates changed

#### Scenario: Content or macro identity changes
- **WHEN** the Authority content hash, selected locale, macro profile, display mode, theme, or density identity changes
- **THEN** only affected cached presentation results SHALL be invalidated
- **AND** stale markup SHALL NOT be reused across the changed identity

### Requirement: Materialized Formula nodes carry bounded governed mathematics
Every materialized active Formula node SHALL carry an exact-release governed formula projection suitable for the requested locale and shared strict KaTeX renderer. The projection MUST NOT expose raw original TeX, unbounded sidecar indexes or another release's fallback.

#### Scenario: Formula enters a one-hop network
- **WHEN** an eligible Formula node is returned by bounded search or neighborhood disclosure
- **THEN** its public presentation SHALL include the matching governed formula render projection
- **AND** the projection identity SHALL match the containing shard and locale qualification

#### Scenario: Formula record is missing or unsafe
- **WHEN** a reachable Formula lacks a valid current render record or reviewed unavailable disposition
- **THEN** candidate qualification SHALL fail closed
- **AND** the canvas SHALL not substitute the prose label as if it were the formula

### Requirement: Force motion does not rerender formula content
Formula DOM SHALL be cached by immutable render identity and locale. Force ticks, drag, camera movement and zoom SHALL update only placement, visibility and opacity.

#### Scenario: Formula node moves during reheat
- **WHEN** force or camera state changes the formula's screen coordinates
- **THEN** the cached rendered mathematics SHALL move with the node
- **AND** KaTeX SHALL not execute again solely because coordinates changed

