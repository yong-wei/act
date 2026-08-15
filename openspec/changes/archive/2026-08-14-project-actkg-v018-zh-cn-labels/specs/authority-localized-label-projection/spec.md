## ADDED Requirements

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

## ACCEPTED Remediation

Sol DECIDE=C (2026-08-15) supersedes the earlier dotted-token allowlist. The
generic `isSafeAuthorityLabel` remains fail-closed: it scans every `./` and
`.\\` token from its own dot, independently of the preceding character, and
rejects all of them. No general Formula exception, command whitelist, or TeX
parser is introduced.

Only the immutable resolver's display-name fallback may use an explicit
versioned pin when the admitted runtime profile, snapshot, release, canonical
Formula ID, and original displayName UTF-8 SHA-256 all match. The pin is
considered only when the sole failure class is the ambiguous Formula `.` + `\\`
token. Preferred and alternative rows, ordinary or untrusted objects,
non-admitted evidence, any drift, and URI, absolute/UNC/relative path,
identity/hash, control, malformed, unknown-command, or additional-token
failures remain unavailable. The v0.18 scan records ten exact pin candidates
among 1,779 Formula records and excludes the five records with additional hard
path evidence.

#### Scenario: A pinned Formula fallback is bound to one admitted record

- **WHEN** an immutable `Formula` object's fallback `displayName` is one of
  the ten v0.18 ambiguity records and its runtime profile ID/SHA-256, snapshot
  ID/hash, release ID, canonical ID, and original UTF-8 displayName SHA-256 all
  match the versioned pin
- **THEN** the resolver SHALL retain the original displayName only in its
  fallback branch
- **AND WHEN** any binding, canonical type/ID, displayName bytes, preferred or
  alternative row, admission state, or failure class differs
- **THEN** the resolver SHALL fail closed without exposing the rejected value
