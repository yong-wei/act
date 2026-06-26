## ADDED Requirements

### Requirement: Source Pack consumers render citations through platform citation UI
Source Pack consumer integrations SHALL render verified citations through platform-owned citation payloads and click behavior.

#### Scenario: Konling consumes a Source Pack item
- **WHEN** a Source Pack item is used as evidence for a Konling answer
- **THEN** its CitationAddress, CitationTarget, display label, limitation state, and source metadata SHALL be passed to the citation presentation layer
- **AND** the frontend SHALL render the citation from that metadata rather than asking the model to author Markdown links.

#### Scenario: Source Pack item has no navigable target
- **WHEN** a Source Pack item is relevant but its citation address is restricted, missing, stale, or unavailable
- **THEN** the consumer SHALL expose the limitation state in the citation UI
- **AND** it SHALL not synthesize a fallback `/knowledge#user-content-*` link.
