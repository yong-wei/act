## ADDED Requirements

### Requirement: Textbook search-document rows are classified in citation shards
Textbook search-document rows SHALL be reviewed in deterministic citation shards before they are treated as verified grounding material.

#### Scenario: Search-document shard is selected
- **WHEN** helper output reports textbook-search-document rows with missing review state, citation anchor, parent-section link, graph refs, or limitation state
- **THEN** the implementation SHALL select a bounded deterministic shard prioritized by active LearningGoals, reviewed parent sections, and high-priority graph domains
- **AND** it SHALL record selected ids, parent refs, blocker codes, source hashes, and residual unselected counts.

#### Scenario: Search-document row is citation support
- **WHEN** a selected search-document row is used for RAG, Konling, or path rationale grounding
- **THEN** it SHALL declare parent section or citation target, page/figure/table/equation anchor where available, graph refs, authority, privacy scope, source hash, review state, limitation state, and reviewer-visible rationale
- **AND** display links SHALL resolve through server-owned citation metadata.

#### Scenario: Search-document row lacks verified anchor
- **WHEN** a selected row has incomplete parent, anchor, source, or permission metadata
- **THEN** it SHALL be limited or excluded with rationale
- **AND** it SHALL NOT be presented as a verified citation.
