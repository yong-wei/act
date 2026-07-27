## ADDED Requirements

### Requirement: EvidenceSegment seeds resolve to readable ACT citation targets
The retrieval system MUST resolve an ActKG EvidenceSegment through a versioned Crosswalk to an ACT structural text unit, RetrievalChunk, and CitationTarget before it can support a final citation.

#### Scenario: Crosswalk resolves
- **WHEN** source identity, segment identity, version, and content hash match
- **THEN** retrieval SHALL use the ACT text and return a navigable structural citation target

#### Scenario: Crosswalk is missing or drifted
- **WHEN** no exact Crosswalk target exists
- **THEN** the seed SHALL remain diagnostic-only and MUST NOT be cited or silently resolved through Legacy knowledge

### Requirement: Final citations remain structural and numbered
The final answer SHALL present verified sources as numbered citations that resolve to the most specific available user-readable textbook structure.

#### Scenario: Atomic subsection supports the claim
- **WHEN** a paragraph or numbered subunit is the best evidence
- **THEN** the citation SHALL target that unit rather than a broad chapter or graph node
