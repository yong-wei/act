## ADDED Requirements

### Requirement: Governed ACT Crosswalks resolve to readable citation targets
The retrieval system MUST resolve an upstream aggregate RAG reference through a current, version-matched ACT EvidenceStructuralUnitCrosswalk to an ACT structural text unit, RetrievalChunk, and CitationTarget before it can support a final citation.

#### Scenario: Crosswalk resolves
- **WHEN** aggregate ReleaseSet, upstream reference, source edition, structural unit, inventory capture, version, and content hash match
- **THEN** retrieval SHALL use the ACT text and return a navigable structural citation target

#### Scenario: Crosswalk is missing or drifted
- **WHEN** no exact current ACT Crosswalk target exists
- **THEN** the upstream reference SHALL remain diagnostic-only and MUST NOT be cited, treated as ACT content, or silently resolved through Legacy knowledge

### Requirement: Final citations remain structural and numbered
The final answer SHALL present verified sources as numbered citations that resolve to the most specific available user-readable textbook structure.

#### Scenario: Atomic subsection supports the claim
- **WHEN** a paragraph or numbered subunit is the best evidence
- **THEN** the citation SHALL target that unit rather than a broad chapter or graph node
