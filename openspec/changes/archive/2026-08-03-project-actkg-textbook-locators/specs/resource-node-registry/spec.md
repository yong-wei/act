## MODIFIED Requirements

### Requirement: Core textbook sections are reviewed at section grain
Core textbook resources SHALL enter path planning only through reviewed section-level planning units or explicit non-planning dispositions. Textbook resources projected from ActKG MUST be represented at `TEXTBOOK`/`CHAPTER`/`SECTION` grain using stable SourceDocument/SourceAnchor locator identities. A locator-only section MUST remain reference-governed and MUST NOT become path-eligible without the existing resource review contract.

#### Scenario: Core textbook section is promoted
- **WHEN** a core automatic-control textbook section is promoted to path-plannable or remediation-capable
- **THEN** it SHALL include book ref, section ref, citation address, graph mapping, LearningGoal fit, prerequisite position, estimated time, path role, authority level, privacy policy, source hash, and review metadata.

#### Scenario: Textbook chunk remains citation support
- **WHEN** a paragraph chunk, figure description, caption, equation anchor, or table anchor lacks independent route and evidence contract
- **THEN** it SHALL remain supporting citation or embedded asset linked to a reviewed parent section.

#### Scenario: Public textbook sidecar resolves
- **WHEN** a SourceDocument, SourceAnchor, section/page locator, and Canonical ID match the same Authority capture
- **THEN** the registry SHALL emit a stable textbook section resource and preserve its locator provenance

#### Scenario: Unauthorized body text is absent
- **WHEN** the public Bundle contains locator metadata but no authorized textbook body
- **THEN** the registry SHALL retain a reference-only resource
- **AND** it SHALL not copy or expose raw textbook text

### Requirement: Long-form resource exclusions are explicit
Long-form resources that should not enter path planning SHALL have reviewed exclusion rationale. The textbook projection MUST record explicit access and exclusion reasons. Missing locator sidecar data SHALL block only the affected textbook slice and MUST NOT be interpreted as an upstream Authority failure.

#### Scenario: Section is unsuitable for path planning
- **WHEN** a textbook or reference section is obsolete, too advanced, copyright-restricted, duplicate, off-topic, or unsuitable for the course path
- **THEN** it SHALL be classified as excluded with rationale
- **AND** the helper SHALL not count it as an unexplained missing planning resource.

#### Scenario: Sidecar row is missing
- **WHEN** a selected textbook section lacks a valid public locator or crosswalk row
- **THEN** that textbook slice SHALL be `REVIEW_REQUIRED`
- **AND** unrelated resources and Authority SHALL remain usable
