## MODIFIED Requirements

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
