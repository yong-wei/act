# konling-agent-runtime Specification Delta

## ADDED Requirements

### Requirement: Konling exposes a read-only engineering graph tool
Konling SHALL expose a read-only engineering graph retrieval tool that queries the ActKG engineering corpus composed from the layered payload, bounded by the focus Canonical IDs and a predicate allowlist. The tool MUST NOT mutate graph state and MUST NOT expand beyond the authorized scope. The legacy `search_knowledge_graph` tool against the retired Prisma knowledge-node table SHALL NOT be presented as the engineering graph.

#### Scenario: Engineering neighborhood is retrieved within scope
- **WHEN** the model calls the engineering graph tool for a question about a focused Canonical ID
- **THEN** the tool SHALL return a bounded neighborhood summary from the engineering RAG query over the layered-payload corpus
- **AND** every returned relation SHALL carry its predicate, direction, and ReleaseSet provenance

#### Scenario: Tool input escapes the focus allowlist
- **WHEN** the tool is called with Canonical IDs outside the authorized focus set
- **THEN** the server SHALL reject or clip those IDs before retrieval
- **AND** the tool SHALL NOT return engineering nodes outside the authorized scope

#### Scenario: Tool attempts a state change
- **WHEN** a request through the engineering graph tool attempts to create, update, or delete graph content
- **THEN** the server SHALL reject the action
- **AND** the tool SHALL remain read-only in the registry permission tier

### Requirement: Production answer retrieval authority switches through governed cutover
The retrieval authority for production answers SHALL remain LEGACY until a shadow-comparison gate against the composed canonical RAG passes and the switch is explicitly authorized. The shadow diagnostic path MUST be a real data path collecting comparison metrics before the switch, or be removed as dead code with the decision recorded. The switch SHALL be reversible by configuration without data migration.

#### Scenario: Shadow comparison runs before cutover
- **WHEN** the composed canonical RAG path is wired as a shadow diagnostic alongside the legacy path
- **THEN** the runtime SHALL record comparison metrics for sampled production answers
- **AND** production answers SHALL continue to be served from the LEGACY authority

#### Scenario: Cutover is authorized after the gate passes
- **WHEN** shadow metrics meet the recorded threshold and the switch is authorized
- **THEN** the production answer authority SHALL resolve to the composed path
- **AND** reverting the configuration SHALL restore LEGACY without any data migration

#### Scenario: Dead shadow code is not silently kept
- **WHEN** the shadow diagnostic input is never supplied by any caller
- **THEN** the change SHALL either wire the input so the diagnostic executes, or remove the dead path
- **AND** the decision and its evidence SHALL be recorded

### Requirement: Dual-domain provenance survives to the client
The engineering and teaching domain provenance persisted with assistant messages SHALL be consumable by the client citation presentation, and teaching resource identifiers persisted in the dual-domain provenance metadata SHALL match the resources offered as citations.

#### Scenario: Message carries dual-domain provenance
- **WHEN** an assistant message persists dual-domain provenance including teaching resource ids
- **THEN** the client citation panel SHALL be able to reconcile cited resources with those persisted ids
- **AND** a citation whose resource id is absent from the persisted provenance SHALL be treated as unverified
