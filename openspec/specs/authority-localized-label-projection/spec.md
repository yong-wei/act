# authority-localized-label-projection Specification

## Purpose
TBD - created by archiving change project-actkg-v018-zh-cn-labels. Update Purpose after archive.
## Requirements
### Requirement: Localized labels resolve from one admitted Authority profile

The label resolver MUST use the selected snapshot, stable entity ID, exact
`zh-CN` language, and admitted runtime Projection Profile. It MUST NOT search a
different release, profile, global registry, or localized string match.

#### Scenario: A canonical Chinese preferred row exists

- **WHEN** the selected entity has one validated `canonical_preferred` `zh-CN` row
- **THEN** its label SHALL be the primary learner-facing display label

#### Scenario: Only an alternative Chinese row exists

- **WHEN** the selected entity has a validated `alternative` row but no
  `canonical_preferred` row
- **THEN** the alternative SHALL be retained as an alias and the primary label
  SHALL fall back to the admitted Projection `display_name`

#### Scenario: No terminology row exists

- **WHEN** no admitted primary Chinese row exists for the entity
- **THEN** the resolver SHALL use the profile's reviewed `display_name` without
  changing entity identity

### Requirement: Localized presentation cannot change graph or teaching identity

Labels and aliases MUST NOT alter canonical IDs, node keys, relation endpoints,
Projection hashes, Teaching Projection predicates, prerequisites, card/media
association, or mapping decisions.

#### Scenario: Chinese and English names appear similar

- **WHEN** two objects have similar localized or fallback text
- **THEN** the system MUST continue to resolve graph and teaching records only by
  their declared identities

### Requirement: Unsafe system identity is never a display fallback

Canonical IDs, relation IDs, Bundle or Release strings, terminology assertion
IDs, hashes, source paths, and machine slugs MUST NOT appear in learner-visible
text, accessible names, titles, URLs, analytics labels, or errors.

#### Scenario: A projected display name is an unsafe identifier

- **WHEN** the primary and fallback candidates fail the human-readable label policy
- **THEN** the affected presentation response SHALL fail closed with a bounded
  human message and SHALL NOT reveal the rejected value

### Requirement: Terminology coverage remains additive

The renderer MUST consume the versioned label projection generically so a later
admitted snapshot can add reviewed terminology rows without a renderer code
change. Missing Chinese coverage alone MUST NOT invalidate Authority identity.

#### Scenario: A later snapshot adds a reviewed label

- **WHEN** the newly selected snapshot passes admission and contains a new valid row
- **THEN** the next materialized presentation SHALL expose it without modifying
  node or relation identity

