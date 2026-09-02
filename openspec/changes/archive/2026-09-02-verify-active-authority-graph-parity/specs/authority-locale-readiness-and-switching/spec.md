## ADDED Requirements

### Requirement: Bilingual acceptance exercises a fully loaded graph
Final acceptance SHALL switch a graph with an active domain, selected concept, one-hop network, relation filters, Formula label and open inspector between Chinese and English and back. All state and identity SHALL remain stable and every surface SHALL change locale atomically.

#### Scenario: Fully loaded graph switches languages
- **WHEN** the bilingual acceptance scenario alternates locales
- **THEN** visible and accessible records SHALL match the selected qualified locale after each commit
- **AND** disabled controls, mixed frames, stale detail or fallback values SHALL fail completion
