## ADDED Requirements

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
