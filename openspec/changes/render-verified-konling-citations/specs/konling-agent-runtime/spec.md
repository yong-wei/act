## ADDED Requirements

### Requirement: Konling renders verified citations from server-owned metadata
Konling SHALL present answer citations from server-owned citation metadata rather than model-authored Markdown footnotes.

#### Scenario: Final assistant message includes citation metadata
- **WHEN** a Konling assistant message includes `konlingCitationGuard`, Source Pack citations, or CitationChip payloads
- **THEN** the UI SHALL render citations from that metadata with display title, source type, confidence, limitation state, and click target
- **AND** model-authored Markdown footnotes SHALL NOT be treated as verified citations.

#### Scenario: Citation metadata is limited or unavailable
- **WHEN** a citation has missing, restricted, stale, low-confidence, or unavailable address metadata
- **THEN** the UI SHALL show the limitation state
- **AND** it SHALL NOT navigate to a meaningless page anchor or present the citation as fully verified.

### Requirement: Konling assistant prose suppresses fake citation footnotes
Konling SHALL prevent model-authored GFM footnotes and generated `#user-content-fn*` anchors from appearing as platform citations.

#### Scenario: Model emits duplicate Markdown footnotes
- **WHEN** model prose contains repeated GFM footnotes such as duplicate `[1]` references or `[^content]` definitions
- **THEN** the message renderer SHALL strip, disable, or normalize those footnotes so they are not displayed as verified citations
- **AND** verified citation numbering SHALL be derived only from server-owned citation metadata.

#### Scenario: Model emits current-page footnote anchors
- **WHEN** model prose contains links to `#user-content-fn*` or `#user-content-fnref*`
- **THEN** those links SHALL NOT be rendered as clickable verified citation links
- **AND** the user SHALL not be routed to `/knowledge#user-content-*` as if it were a source.

### Requirement: Konling distinguishes streaming diagnostics from final citation state
Konling SHALL keep development diagnostics separate from the final user-facing citation presentation.

#### Scenario: Streaming answer has not completed final citation verification
- **WHEN** the response is still streaming and diagnostics are enabled
- **THEN** the UI MAY show a development diagnostic notice
- **AND** that notice SHALL be visually and semantically distinct from verified citations.

#### Scenario: Final answer completes citation verification
- **WHEN** final message metadata is available
- **THEN** the UI SHALL render the final verified, limited, or missing citation state from metadata
- **AND** it SHALL not rely on diagnostic text embedded in the prose as the citation UI.
