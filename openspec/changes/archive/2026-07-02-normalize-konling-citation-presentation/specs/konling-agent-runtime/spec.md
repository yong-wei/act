## MODIFIED Requirements

### Requirement: Konling renders verified citations from server-owned metadata
Konling SHALL present answer citations from server-owned citation metadata rather than model-authored Markdown footnotes.

#### Scenario: Final assistant message includes citation metadata
- **WHEN** a Konling assistant message includes `konlingCitationGuard`, Source Pack citations, or CitationChip payloads
- **THEN** the UI SHALL render citations from normalized server-owned metadata with display title, source type, confidence, citation-level limitation state, and click target
- **AND** model-authored Markdown footnotes SHALL NOT be treated as verified citations.

#### Scenario: Citation metadata is limited or unavailable
- **WHEN** a citation has missing, restricted, stale, low-confidence, or unavailable address metadata
- **THEN** the UI SHALL present the citation as limited or unavailable with a safe label
- **AND** it SHALL NOT navigate to a meaningless page anchor or present the citation as fully verified.

#### Scenario: Citation presentation is normalized before rendering
- **WHEN** raw Konling guard metadata, Source Pack items, knowledge node citations, path-execution evidence, learner-state evidence, simulation evidence, or Arena evidence are available for a final assistant message
- **THEN** the system SHALL normalize them into a deterministic citation presentation model before any chat UI renders the message
- **AND** each normalized item SHALL include a stable key, display index, title, source type, confidence, citation-level limitation state, safe href when available, and evidence basis metadata.

#### Scenario: Verified content citations coexist with limited personalization
- **WHEN** a final answer has high-confidence or medium-confidence teaching-content citations with safe server-owned targets
- **AND** learner-state, path-execution, or personalization evidence is missing or limited
- **THEN** the teaching-content citations SHALL remain clickable
- **AND** the final answer summary MAY disclose limited personalization without globally disabling unrelated verified content citations.

#### Scenario: Citations are deduplicated by governed source identity
- **WHEN** multiple raw citation entries point to the same governed source, retrieval chunk, citation target, knowledge node, textbook section, path execution evidence, learner-state evidence, simulation trace, or Arena evidence
- **THEN** the normalized citation presentation SHALL deduplicate entries using type-aware stable keys before assigning display numbers
- **AND** it SHALL NOT merge citations across different source types only because their titles match.

### Requirement: Konling assistant prose suppresses fake citation footnotes
Konling SHALL prevent model-authored GFM footnotes and generated `#user-content-fn*` anchors from appearing as platform citations.

#### Scenario: Model emits duplicate Markdown footnotes
- **WHEN** model prose contains repeated GFM footnotes such as duplicate `[1]` references or `[^content]` definitions
- **THEN** the message renderer SHALL strip, disable, or normalize those footnotes so they are not displayed as verified citations
- **AND** verified citation numbering SHALL be derived only from server-owned citation metadata.

#### Scenario: Model emits current-page footnote anchors
- **WHEN** model prose contains current-page footnote anchors such as `#user-content-fn-content` or `#user-content-fnref-content`
- **THEN** those links SHALL NOT be rendered as clickable verified citation links
- **AND** normalized citation links SHALL use only safe server-owned citation targets.

### Requirement: Konling distinguishes streaming diagnostics from final citation state
Konling SHALL keep development diagnostics separate from the final user-facing citation presentation.

#### Scenario: Streaming answer has not completed final citation verification
- **WHEN** Konling streams a development-mode answer before final citation verification completes
- **THEN** any visible diagnostic notice SHALL be prefixed as development-mode diagnostics
- **AND** that notice SHALL be visually and semantically distinct from verified citations.

#### Scenario: Final answer completes citation verification
- **WHEN** the assistant message has completed generation and final citation metadata is available
- **THEN** the UI SHALL render the final verified, limited, or missing citation state from normalized metadata
- **AND** it SHALL not rely on diagnostic text embedded in the prose as the citation UI.
