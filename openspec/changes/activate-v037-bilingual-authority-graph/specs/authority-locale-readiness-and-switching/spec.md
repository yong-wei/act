## ADDED Requirements

### Requirement: Exact active v0.37 locale evidence is independently qualified offline
ACT SHALL adapt and independently qualify the immutable locale evidence belonging to the exact active v0.37 Authority envelope. Qualification MUST cover every visible domain and every object, relation, direction, alias, source, rich-text, formula and accessibility record reachable through the sealed graph closure, and MUST NOT accept an upstream readiness boolean without recomputation.

#### Scenario: Complete v0.37 bilingual evidence is admitted
- **WHEN** the exact active release, snapshot, catalog, shard set and language component all match and both denominators pass
- **THEN** ACT SHALL seal ready Chinese and English qualification receipts for that identity
- **AND** runtime capability SHALL advertise `zh-CN` and `en` without changing production selectors

#### Scenario: One catalog domain lacks shard or locale coverage
- **WHEN** any visible domain or reachable presentation record is absent from the denominator or numerator
- **THEN** bilingual qualification SHALL fail closed
- **AND** English SHALL remain unavailable without using another release or language fallback

### Requirement: Runtime locale qualification uses immutable receipts
Ordinary root, domain, family, neighborhood and detail requests SHALL verify a bounded immutable locale qualification package. Runtime requests MUST NOT reconstruct the full presentation denominator, traverse every detail shard or parse the complete locale corpus to decide whether English is available.

#### Scenario: Cold root request evaluates capability
- **WHEN** a process handles its first active root request
- **THEN** it SHALL verify the small exact-identity qualification package within the declared latency and I/O budget
- **AND** it SHALL not scan all domain, neighborhood or detail artifacts

### Requirement: Language switching commits one complete locale frame
Changing between available Chinese and English SHALL replace every currently visible and accessible graph presentation atomically for the same identities while preserving topology, force coordinates, camera, filters, selection, inspector section, scroll and resource bindings. A failed or stale refresh MUST leave the preceding locale fully intact.

#### Scenario: Viewer switches a loaded graph to English
- **WHEN** root, domain, selected neighborhood, filters and inspector are open and English is selected
- **THEN** all corresponding English records SHALL commit in one locale generation
- **AND** no intermediate mixed Chinese/English frame SHALL be observable

#### Scenario: One English shard fails
- **WHEN** any required response fails identity, locale profile or availability verification
- **THEN** the client SHALL keep the complete Chinese frame and report a bounded Chinese failure
- **AND** it SHALL not commit partial English records or clear graph state
