## ADDED Requirements

### Requirement: Citations resolve through server-owned addresses
Verified citations SHALL resolve through a server-owned CitationAddress contract rather than model-authored URLs.

#### Scenario: Citation target is resolved
- **WHEN** a generated answer references a verified chunk id, source span, or citation ref
- **THEN** the resolver SHALL produce the display href, address kind, display title, freshness state, and limitation state from server-owned metadata
- **AND** the model-generated answer SHALL NOT be trusted to construct the final URL.

#### Scenario: Deep link is unavailable
- **WHEN** a citation points to a missing block, stale hash, inaccessible media time range, restricted image, unregistered interactive step, or unsafe external URL
- **THEN** the system SHALL reject, redact, or downgrade the citation
- **AND** the product payload SHALL expose that the citation cannot be opened as a fully verified source.
