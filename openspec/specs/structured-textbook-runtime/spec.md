# structured-textbook-runtime Specification

## Purpose
TBD - created by archiving change export-structured-textbook-runtime. Update Purpose after archive.
## Requirements
### Requirement: Textbook authoring sources remain canonical
The system SHALL treat the existing chapter Markdown and referenced local assets as the canonical textbook authoring sources.

#### Scenario: Runtime structure is exported
- **WHEN** a textbook runtime export runs
- **THEN** it SHALL derive all hierarchy, units, anchors, and retrieval windows from the authoring source and per-book parsing configuration
- **AND** it SHALL NOT rewrite the authoring source merely to match runtime folder layout.

#### Scenario: Authoring structure is defective
- **WHEN** distributed review confirms that a heading, numbering level, or content boundary is defective in the Mathpix-converted source
- **THEN** the source defect SHALL be corrected in the authoring Markdown before the runtime is regenerated
- **AND** the runtime output SHALL NOT be patched independently.

### Requirement: Textbook hierarchy is parsed deterministically
The exporter SHALL combine common numbering rules with declarative per-book configuration and SHALL fail when a parent-child relationship cannot be determined.

#### Scenario: Numbering is recognized
- **WHEN** Markdown headings, Chinese or Arabic numbering, parenthesized numbering, or configured book-specific structures are encountered
- **THEN** the exporter SHALL produce one deterministic hierarchy with explicit parent identifiers and source spans.

#### Scenario: Hierarchy remains ambiguous
- **WHEN** common rules and the book configuration cannot uniquely assign a structural unit
- **THEN** the export SHALL fail with a bounded anomaly identifying the source location and ambiguity
- **AND** it SHALL NOT silently flatten or guess the unit.

### Requirement: Citation units and retrieval windows are separate
The runtime SHALL store non-overlapping structural units as citation identities and MAY derive overlapping retrieval windows only as machine retrieval context.

#### Scenario: Retrieval window crosses unit boundaries
- **WHEN** a retrieval window combines a primary unit with ancestor or adjacent text
- **THEN** every included span SHALL retain its owning structural-unit identifier
- **AND** the window identifier SHALL NOT become a citation target.

#### Scenario: Citation support is selected
- **WHEN** a claim is supported by one deepest sufficient structural unit
- **THEN** the citation SHALL address that unit or one of its fragment anchors
- **AND** a parent unit SHALL be used only when the claim genuinely spans multiple children.

### Requirement: Structural identities and fragment anchors are stable
The runtime SHALL derive structural-unit paths from book identity, edition, and deterministic hierarchy rather than mutable body text.

#### Scenario: Numbered unit text changes
- **WHEN** the title or body of an existing naturally numbered unit is corrected without changing its structural number
- **THEN** its structural path SHALL remain unchanged.

#### Scenario: Formula, figure, or table is addressed
- **WHEN** a formula, figure, or table belongs to a structural unit
- **THEN** it SHALL receive a stable fragment anchor inside that unit
- **AND** it SHALL NOT create an independent directory or duplicate the surrounding prose.

### Requirement: Structural exports are anomaly-audited
The export workflow SHALL detect abnormal units and SHALL require distributed chapter sampling before the v2 test runtime is accepted.

#### Scenario: Full source set is prepared
- **WHEN** the first v2 runtime is generated for the declared resource set
- **THEN** every chapter in every declared book SHALL be checked for empty or extreme units, numbering discontinuity, hierarchy jumps, misplaced text, and unrecognized natural numbering
- **AND** sampled deepest units, boundaries, sequences, and maximum/minimum units SHALL be reviewed.

#### Scenario: Review finds no unresolved anomaly
- **WHEN** all confirmed source and parser defects have been corrected and the export is repeated
- **THEN** the v2 test runtime SHALL be accepted as input to downstream retrieval and reader changes
- **AND** it SHALL remain disconnected from production consumers until the final integration change.

### Requirement: Textbook runtime exports use the declared resource set
The textbook runtime exporter SHALL derive its book input set from `course-content/config/textbook-resource-set.json` and SHALL derive the expected book count from the declared `books` array rather than a hard-coded textbook count.

#### Scenario: Runtime export is run
- **WHEN** the structured textbook runtime exporter runs with a resource set
- **THEN** it SHALL read the resource set and export every declared book
- **AND** it SHALL resolve the authoring and structure configuration roots from the resource set
- **AND** it SHALL NOT require a fixed seven-book or other hard-coded count

#### Scenario: Resource set is empty or invalid
- **WHEN** the resource set declares no books or contains duplicate or unsafe book ids
- **THEN** the exporter SHALL fail before producing a partial runtime

#### Scenario: Runtime is validated
- **WHEN** runtime validation runs
- **THEN** the validator SHALL compare actual runtime book directories against the declared resource set
- **AND** sourceRevision and manifest hash SHALL remain bound to the exported runtime

### Requirement: Runtime assets reuse the resource set
The runtime asset exporter SHALL read book configurations from the same resource set and SHALL export assets for every declared book.

#### Scenario: Asset export is run
- **WHEN** runtime asset export runs with a resource set
- **THEN** it SHALL process exactly the declared books
- **AND** it SHALL NOT assume the historical seven-book list

#### Scenario: Book configuration is missing
- **WHEN** a declared book has no matching structure configuration
- **THEN** the exporter SHALL fail closed with a clear missing-configuration error

### Requirement: Remote provenance verification deploys the resource set contract
The remote deployment workflow SHALL publish the provenance helper, its resource set helper dependency, and the resource set configuration as one release unit before remote provenance verification runs. Daily application deploy SHALL use `ossfs-blob-view` and bind an independently published runtime view; runtime content updates SHALL use the explicit runtime-release path. The workflow SHALL NOT restore default runtime rsync, and SHALL NOT treat v1 `ossfs-release` as the daily default.

#### Scenario: A remote host lacks the previous helper or configuration
- **WHEN** default `ossfs-blob-view` application deploy, or an explicit runtime-release deploy, reaches remote provenance verification
- **THEN** the workflow SHALL upload `textbook-runtime-v2-provenance.mjs`, `textbook-resource-set.mjs`, and `textbook-resource-set.json` as one unit
- **AND** it SHALL execute the provenance helper from the remote repository root when remote provenance verification runs
- **AND** missing or inconsistent helper/configuration files SHALL fail the deployment before it is accepted
- **AND** retired `legacy-rsync` SHALL fail closed
- **AND** v1 `ossfs-release` SHALL remain a compatibility entry only

### Requirement: Textbook corpus admission provenance is resource-set complete
When a textbook corpus input changes, the exporter SHALL emit a versioned input-provenance document whose authoring revision field is named `authoringSourceRevision` and that binds the complete resourceSetId, canonical resource-set digest, normalized unique book IDs, input digest, positive input file count and generator identity. The exported runtime book directories SHALL equal the provenance book IDs exactly, and every book manifest SHALL carry the same `authoringSourceRevision`. External bundle `sourceRevision` / `baseSourceRevision` and runtime Release `sourceRevision` SHALL remain release/capture identities and SHALL NOT be compared to or substituted for `authoringSourceRevision`.

#### Scenario: A changed textbook corpus is exported
- **WHEN** a resource set, declared book, authoring input, parser configuration, runtime/index byte or generator identity changes
- **THEN** the exporter SHALL produce `act.textbook-runtime-input-provenance.v2` from the frozen inputs
- **AND** the v2 provenance SHALL identify the exact resource set and book IDs without a fixed book count

#### Scenario: Provenance and runtime book set diverge
- **WHEN** the runtime contains a missing, additional or same-count different book relative to provenance or the declared resource set
- **THEN** validation SHALL fail before external bundle preparation or runtime publication

#### Scenario: Application revision differs from authoring revision
- **WHEN** an application or runtime Release commit changes while an admitted textbook corpus remains byte-identical and frozen
- **THEN** the system SHALL preserve the textbook authoring source revision independently
- **AND** it SHALL NOT require the textbook revision to equal the application, Release or PR HEAD

#### Scenario: Publication validates distinct revision domains
- **WHEN** `authoringSourceRevision` differs from the external bundle or runtime Release source revision
- **THEN** preflight SHALL compare provenance, every runtime book manifest and the hybrid index to the authoring revision
- **AND** it SHALL compare bundle capture, Git declaration, source proof and Release manifest within the release/capture revision domain
- **AND** the differing revisions SHALL NOT by themselves prevent publication

### Requirement: Legacy textbook provenance remains immutable and bounded
An immutable Release carrying `act.textbook-runtime-input-provenance.v1` SHALL remain verifiable and selectable only under its existing validated lifecycle identity. A descendant runtime Release MAY inherit that frozen external textbook input only when every textbook prefix, declaration Git object, bundle semantic/wire digest and file source identity remains exact. Any changed textbook corpus SHALL require the resource-set-complete provenance contract and SHALL NOT reinterpret or rewrite a v1 Release.

#### Scenario: Unrelated runtime content changes
- **WHEN** a descendant runtime Release changes no textbook prefix and inherits the exact validated v1 external bundle identity
- **THEN** publication MAY preserve that frozen textbook input without regenerating it
- **AND** inspection SHALL identify the provenance generation as legacy

#### Scenario: A v1 textbook corpus is changed
- **WHEN** any textbook book set, source revision, input digest, runtime/index byte, declaration or bundle identity differs
- **THEN** publication SHALL reject v1 inheritance and require a new resource-set-complete provenance document

#### Scenario: Historical Release is inspected
- **WHEN** an active or rollback Release contains v1 provenance without an explicit resourceSet identity
- **THEN** inspection SHALL report only the fields proved by that Release
- **AND** it SHALL NOT fabricate current resourceSet admission from Blob presence or historical book directories

