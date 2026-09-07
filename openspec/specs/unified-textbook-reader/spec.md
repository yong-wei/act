# unified-textbook-reader Specification

## Purpose
TBD - created by archiving change build-unified-textbook-reader. Update Purpose after archive.
## Requirements
### Requirement: Textbooks use one hierarchical reader
The platform SHALL render all runtime textbooks through one reader with a navigable chapter tree and the current structural-unit body.

#### Scenario: Reader opens a textbook unit
- **WHEN** an authorized user opens a valid textbook structure path
- **THEN** the left pane SHALL show the expandable book hierarchy with the current unit selected
- **AND** the right pane SHALL show that unit's authored body in its book context.

#### Scenario: User navigates within the book
- **WHEN** the user selects another visible unit in the hierarchy
- **THEN** the reader SHALL navigate to that unit's stable URL
- **AND** it SHALL NOT require returning to the originating citation.

### Requirement: Textbook routes use stable structural identities
The reader SHALL resolve `/textbooks/{bookId}/{edition}/{...unitPath}` through the server-owned v2 runtime index rather than physical runtime file paths.

#### Scenario: Unit URL is resolved
- **WHEN** the book, edition, and structural path identify a runtime unit
- **THEN** the server SHALL load that unit and its hierarchy metadata
- **AND** it SHALL NOT expose or accept an arbitrary local file path.

#### Scenario: Legacy chunk URL is requested
- **WHEN** a caller uses an old section or chunk address after the final series cutover
- **THEN** the reader SHALL NOT translate or redirect it to a v2 unit
- **AND** no persistent legacy mapping SHALL be required.

### Requirement: Textbook fragments focus authored content
Formula, figure, and table fragments SHALL resolve within their owning structural unit and SHALL preserve surrounding authored context.

#### Scenario: Valid fragment is opened
- **WHEN** a reader URL contains a registered formula, figure, or table anchor
- **THEN** the owning unit SHALL render and the target fragment SHALL be focused and scrolled into view.

#### Scenario: Fragment is missing
- **WHEN** the unit exists but the requested fragment does not
- **THEN** the unit SHALL remain readable
- **AND** the reader SHALL expose a bounded unavailable-location state rather than guessing another fragment.

### Requirement: Textbook citations open as modal or standalone views
The same textbook URL SHALL support an in-application closable modal and a directly loaded standalone reader.

#### Scenario: Citation is opened inside the platform
- **WHEN** a user clicks a textbook citation from a platform page
- **THEN** an intercepting modal SHALL open with the reader and update the URL
- **AND** closing it SHALL restore the originating page and URL.

#### Scenario: Textbook URL is loaded directly
- **WHEN** a user opens, refreshes, or shares the same URL outside the intercepting navigation
- **THEN** the platform SHALL render a standalone full-page two-column reader at the same location.

### Requirement: Textbook bodies require course authorization
The reader SHALL verify authentication and applicable course access before returning textbook hierarchy or body content.

For the seven v2 textbooks in this change, the applicable course SHALL be `automatic-control`, and an authenticated ACT platform member SHALL have access to that course. Anonymous visitors SHALL be denied. The implementation SHALL NOT infer course access from `StudentProfile.classId` or introduce a parallel course-enrollment data model.

#### Scenario: Authorized learner or teacher opens a link
- **WHEN** the authenticated user has the applicable course access
- **THEN** the requested hierarchy and body SHALL be available according to that role.

#### Scenario: Anonymous or unauthorized user opens a shared link
- **WHEN** authentication is absent or course access is denied
- **THEN** the platform SHALL return the governed login or forbidden state
- **AND** it SHALL NOT disclose textbook body text or physical runtime paths.

#### Scenario: Authenticated platform member opens an automatic-control textbook
- **WHEN** an authenticated ACT platform member opens one of the seven registered v2 textbooks
- **THEN** the server SHALL authorize the request for `automatic-control`
- **AND** it SHALL NOT require or interpret a student class identifier as course enrollment.

### Requirement: Machine retrieval text stays outside reader prose
The reader SHALL display authored structural-unit content and approved accessibility descriptions without rendering retrieval-window overlap or machine-only search aids as ordinary textbook prose.

#### Scenario: Unit participates in several retrieval windows
- **WHEN** the same authored span is present in overlapping machine retrieval windows
- **THEN** the reader SHALL display that authored span once through its owning unit
- **AND** it SHALL NOT expose window identifiers or duplicate overlap text.

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

