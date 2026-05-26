## ADDED Requirements

### Requirement: Interactive lessons resolve through canonical identity
The system SHALL provide one canonical resolver for runtime-first interactive
lesson identity.

#### Scenario: Alias resolves to canonical lesson
- **WHEN** a consumer provides a short id, long lesson id, route segment,
  preset key, runtime directory, manifest lesson key, plan-title alias, or
  evidence alias for a registered interactive lesson
- **THEN** the resolver SHALL return the same canonical lesson id and registry
  record
- **AND** the result SHALL identify which alias family matched.

#### Scenario: Unsupported lesson is explicit
- **WHEN** a consumer provides an unknown, legacy, or incomplete lesson identity
- **THEN** the resolver SHALL return an explicit unsupported or ambiguous
  classification
- **AND** governance consumers SHALL NOT silently coerce it to another lesson.

### Requirement: Identity consumers use the shared registry
The system SHALL derive interactive lesson identity maps from the shared
registry or call the shared resolver directly.

#### Scenario: Runtime and governance identity agree
- **WHEN** classroom routing, session snapshotting, evidence spec lookup,
  submission gate inventory, AI context lookup, and runtime discovery inspect
  the same lesson
- **THEN** they SHALL resolve to the same canonical lesson id.

### Requirement: Identity drift is detected
The system SHALL detect drift between the shared registry and identity consumer
surfaces.

#### Scenario: New lesson is only partially registered
- **WHEN** a lesson appears in a route, preset, runtime, evidence, inventory,
  or AI context surface but is absent from the shared registry
- **THEN** an automated drift check SHALL fail with the missing surface named.
