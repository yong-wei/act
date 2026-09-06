# konling-teaching-resource-citations Specification Delta

## ADDED Requirements

### Requirement: Teaching projection resources resolve to server-verified citation targets
Every teaching-projection linked resource that Konling presents as a clickable citation MUST resolve its href through a server-owned resolver that covers textbook units (via the textbook reader href with a version-bound handle), database teaching resources, and registry resources (via the governed launch/render target). Resources that fail resolution, are teacher-only, or are not visible to the current role MUST NOT receive a citation number or href.

#### Scenario: Bound resource resolves to a clickable citation
- **WHEN** a linked resource in the teaching projection context resolves to a valid href for the current user's role
- **THEN** the runtime SHALL assign it a citation number through the server-owned citation allocator
- **AND** it SHALL write the entry into `konlingCitationGuard.citations` with title, resource identity, and safe href

#### Scenario: Teacher-only resource is requested by a student
- **WHEN** a linked resource is marked teacherOnly and the requester is a student
- **THEN** the resolver SHALL fail closed
- **AND** the resource SHALL appear only as non-link grounding text and SHALL NOT enter the citation panel

#### Scenario: Resource cannot be resolved
- **WHEN** a linked resource id matches no textbook, database, or registry identity
- **THEN** the runtime SHALL NOT fabricate an href
- **AND** it SHALL record the unresolved state in citation metadata without presenting a clickable chip

### Requirement: Resource citations open in the governed viewing surface
A clickable teaching-resource citation chip SHALL open its target in the unified viewer shell when that shell is available, or through the existing full-page route as an explicit degradation. Textbook citations SHALL pass the version-bound-target revalidation before navigation; registry and database resources SHALL be checked against the live registry index and deployed revision alignment.

#### Scenario: Textbook citation is clicked
- **WHEN** a student clicks a textbook citation chip carrying a `?vbh=` handle
- **THEN** the runtime SHALL revalidate the version-bound target before navigation
- **AND** a drifted version SHALL degrade the chip to a limited state instead of navigating to a stale target

#### Scenario: Registry citation is clicked
- **WHEN** a student clicks a citation chip for a registry or database resource
- **THEN** the chip SHALL open the unified viewer shell with the resource rendered in place when the shell is available
- **AND** it SHALL fall back to the existing full-page resource route when the shell is not yet delivered

#### Scenario: Citation metadata retains dual-domain provenance
- **WHEN** a final assistant message persists citations for teaching resources
- **THEN** the message metadata SHALL retain the engineering and teaching domain provenance identities for each cited resource
- **AND** persisted citations SHALL carry the stable resource identity rather than only a display title

### Requirement: Assistant prose remains link-free
Introducing clickable resource citations MUST NOT weaken the existing body sanitizer or citation whitelist enforcement. Model-authored URLs, unassigned citation numbers, and prose links to resources MUST continue to be stripped or suppressed.

#### Scenario: Model emits a raw resource URL in prose
- **WHEN** model output contains a raw URL or an unassigned citation marker pointing at a teaching resource
- **THEN** that syntax SHALL be stripped by the existing sanitizer and whitelist enforcement
- **AND** only server-assigned citation entries SHALL render as clickable chips
