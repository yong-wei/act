## ADDED Requirements

### Requirement: Projection book identities resolve through an explicit alias table
Projection and Authority source-document ids (for example `dorf-modern-control-systems-14th`, `franklin-feedback-control-7th`) MUST resolve to reader book identities through an explicit alias table mapping each source-document id to a reader `bookId` and `edition`. Resolution MUST fail closed when the alias or the target v2 runtime manifest is absent; guessing or prefix matching MUST NOT be used.

#### Scenario: Alias resolves to a registered book
- **WHEN** a citation names a known source-document id
- **THEN** the alias table SHALL yield the reader `bookId` and `edition`
- **AND** the target book SHALL exist in the v2 runtime manifest

#### Scenario: Alias is missing or stale
- **WHEN** a source-document id has no alias row or the aliased manifest is absent
- **THEN** resolution SHALL fail closed
- **AND** no reader href SHALL be fabricated

### Requirement: Mapped citations resolve to reader hrefs via structural coordinates
A mapped citation's `structuralPath` (or `structuralUnitId` resolved through the v2 index) MUST produce the unified reader href via `buildTextbookReaderHref`. A `REFERENCE_ONLY` access mode MUST NOT block opening the in-app reader for an authorized user; it continues to mean that projection and RAG payloads carry no textbook body, and reader access remains governed by the reader's own course authorization.

#### Scenario: Structural coordinate resolves to an href
- **WHEN** a mapped citation carries a valid v2 structural-unit coordinate
- **THEN** the platform SHALL produce the `/textbooks/<bookId>/<edition>/<unitPath>` href through `buildTextbookReaderHref`
- **AND** the href SHALL match the coordinate used by the hybrid retrieval index

#### Scenario: REFERENCE_ONLY citation is opened in-app
- **WHEN** an authorized user opens a citation whose access mode is `REFERENCE_ONLY`
- **THEN** the reader SHALL open the mapped unit under the reader's course authorization
- **AND** projection and RAG payloads SHALL still carry no textbook body for that row
