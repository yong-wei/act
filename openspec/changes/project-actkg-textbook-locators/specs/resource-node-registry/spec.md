## MODIFIED Requirements

### Requirement: Core textbook sections are reviewed at section grain
Textbook resources projected from ActKG MUST be represented at `TEXTBOOK`/`CHAPTER`/`SECTION` grain using stable SourceDocument/SourceAnchor locator identities. A locator-only section MUST remain reference-governed and MUST NOT become path-eligible without the existing resource review contract.

#### Scenario: Public textbook sidecar resolves
- **WHEN** a SourceDocument, SourceAnchor, section/page locator, and Canonical ID match the same Authority capture
- **THEN** the registry SHALL emit a stable textbook section resource and preserve its locator provenance

#### Scenario: Unauthorized正文 is absent
- **WHEN** the public Bundle contains locator metadata but no authorized textbook body
- **THEN** the registry SHALL retain a reference-only resource
- **AND** it SHALL not copy or expose raw textbook text

### Requirement: Long-form resource exclusions are explicit
The textbook projection MUST record explicit access and exclusion reasons. Missing locator sidecar data SHALL block only the affected textbook slice and MUST NOT be interpreted as an upstream Authority failure.

#### Scenario: Sidecar row is missing
- **WHEN** a selected textbook section lacks a valid public locator or crosswalk row
- **THEN** that textbook slice SHALL be `REVIEW_REQUIRED`
- **AND** unrelated resources and Authority SHALL remain usable
