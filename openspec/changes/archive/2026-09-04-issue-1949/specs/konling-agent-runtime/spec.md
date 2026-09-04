## MODIFIED Requirements

### Requirement: Konling uses server-assigned visible citation numbers

Konling SHALL use one server-assigned citation sequence for textbook content and authorized learning evidence and SHALL reject model-authored URLs or new identifiers. Every server-assigned citation entry SHALL carry an explicit verifiability declaration stating whether it resolves to a stable source identity with a valid target anchor; entries without one SHALL NOT be presented as verified citations.

#### Scenario: Citation table is prepared

- **WHEN** eligible content and evidence sources are ready before answer generation
- **THEN** the server SHALL deduplicate them and assign `[1]`, `[2]` display numbers
- **AND** the prompt SHALL allow only those assigned numbers.

#### Scenario: Model emits internal citation syntax

- **WHEN** model prose contains a raw citation id, `[content: ...]`, an unknown number, or a model-authored citation URL
- **THEN** that syntax SHALL NOT become a verified visible citation or link.

#### Scenario: Assigned entry lacks a verifiable target

- **WHEN** the assigned citation table contains a runtime citation whose server-side verification is false or whose citation target id is absent, or a retrieval-assigned citation without a usable anchor address
- **THEN** that entry SHALL be declared unverifiable in the assigned table
- **AND** markers resolving to it SHALL NOT remain in the answer body as verified citations.

### Requirement: Konling repairs unknown citation markers once

Konling SHALL deterministically normalize known citation forms and SHALL permit at most one model repair call for remaining unknown or ambiguous markers. A marker SHALL count as resolved only when it resolves to an assigned citation entry that is declared verifiable; resolution to an unverifiable entry SHALL be handled as an unverified marker.

#### Scenario: Deterministic normalization succeeds

- **WHEN** a marker contains an assigned number, a complete known citation id, or a uniquely matching source title
- **AND** the resolved entry is declared verifiable
- **THEN** the server SHALL map it without an additional model call.

#### Scenario: Marker resolves to an unverifiable entry

- **WHEN** a marker resolves to an assigned citation entry that is declared unverifiable
- **THEN** the marker SHALL be removed from the answer body, recorded as unverified, and downgraded to the applicable partial or unverified verification status with its safe user notice
- **AND** the entry SHALL NOT be listed among the answer's verified citations.

#### Scenario: Unknown markers remain

- **WHEN** deterministic normalization leaves unresolved markers
- **THEN** one repair call SHALL receive the original question, frozen server context, assigned citation table, original answer, and all unresolved markers
- **AND** it SHALL return mappings only without rewriting prose or adding sources.

#### Scenario: Repair still fails

- **WHEN** markers remain unresolved after the repair call
- **THEN** production output SHALL remove their raw syntax and invalid links, preserve the answer prose, and show the applicable safe verification notice
- **AND** detailed reasons SHALL remain available only in development diagnostics.

#### Scenario: Persisted citations carry identity, version, and anchor

- **WHEN** a final answer persists its citation metadata
- **THEN** every persisted verified citation SHALL carry its stable citation identity including the source version fields of its identity kind and the target anchor address or fragment reference
- **AND** student-visible rendering SHALL NOT expose internal citation ids, file paths, or retrieval diagnostics.

### Requirement: Konling removes invalid citation markers from persisted answers

Konling SHALL report numeric citation markers that resolve to missing, out-of-range, or unverified citation numbers, and SHALL remove them from the persisted answer body for every formal answer delivery path, not only when a study-question contract is active.

#### Scenario: An invalid numeric marker appears in the answer

- **WHEN** model output contains a numeric citation marker that is not a server-assigned, verified, target-bearing citation
- **THEN** the marker SHALL be listed in citation metadata as unverified
- **AND** it SHALL be removed from the persisted answer text while valid markers are preserved.

#### Scenario: Invalid markers are stripped outside study questions

- **WHEN** a formal answer without an active study-question contract contains numeric markers that resolve to unassigned numbers or to citations lacking server verification or a citation target
- **THEN** those markers SHALL still be collected as unverified and removed from the persisted answer text
- **AND** the answer SHALL surface the applicable safe verification notice instead of presenting the stripped markers as verified citations.
