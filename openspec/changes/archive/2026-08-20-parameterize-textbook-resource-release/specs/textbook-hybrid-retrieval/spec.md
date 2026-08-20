## ADDED Requirements

### Requirement: Hybrid retrieval index generation and verification use the resource set
The hybrid retrieval index builder and verifier SHALL derive the expected textbook set and expected book count from `course-content/config/textbook-resource-set.json`.

#### Scenario: Index is built
- **WHEN** the hybrid retrieval index builder runs
- **THEN** it SHALL build windows and segments for every declared book
- **AND** the index metadata SHALL record the resourceSetId and sourceRevision used by the build

#### Scenario: Index is verified
- **WHEN** the index verifier runs
- **THEN** it SHALL compare the generated index against the declared resource set
- **AND** it SHALL fail when windows, segments, manifestHash, sourceRevision, or resourceSetId are inconsistent

#### Scenario: Explicit expected count conflicts with resource set
- **WHEN** a caller passes an explicit expected book count that differs from the resource set
- **THEN** verification SHALL fail closed
- **AND** the caller SHALL NOT bypass resource set consistency through a stale count

#### Scenario: Runtime book set diverges
- **WHEN** the runtime contains the same number of books as the resource set but its book ids differ
- **THEN** the builder and verifier SHALL fail closed
- **AND** the generated or accepted index SHALL NOT be considered consistent based on book count alone

#### Scenario: Resource set is invalid
- **WHEN** the resource set has no books or contains invalid book ids
- **THEN** the builder and verifier SHALL fail before producing or accepting an index

## MODIFIED Requirements

### Requirement: Textbook hybrid indexes are file-backed and bounded
The runtime SHALL expose a read-only lexical index, contiguous Float32 vector matrix, window metadata, and body offsets without loading the full textbook corpus into each request.

#### Scenario: Application process loads the index
- **WHEN** the shared textbook retrieval module initializes
- **THEN** one read-only index instance SHALL be shared within the application process
- **AND** its resident index budget SHALL not exceed 150 MiB for the current declared resource set.

#### Scenario: Candidate body is needed
- **WHEN** a retrieval window reaches the bounded candidate set
- **THEN** its body SHALL be read through the recorded offset
- **AND** all textbook bodies SHALL NOT be retained in process memory.
