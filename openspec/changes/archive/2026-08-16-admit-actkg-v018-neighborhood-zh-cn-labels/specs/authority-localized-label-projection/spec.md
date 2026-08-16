## ADDED Requirements

### Requirement: Snapshot-bound reviewed overlay may follow the admitted index

After loading admitted runtime-profile `canonical_preferred` rows, the resolver
MAY merge a reviewed overlay that is bound to the same release and snapshot.
It MUST NOT search another release, profile, or unbound registry. The sealed
v0.18 index count of 1909 MUST remain the admission invariant. After merge,
one entity ID MUST have at most one zh-CN `canonical_preferred` row.

#### Scenario: Overlay supplies a missing preferred row

- **WHEN** the admitted index has no `canonical_preferred` row for an entity
  and the snapshot-bound overlay has one safe zh-CN preferred row
- **THEN** the resolver SHALL use the overlay label as the primary display label

#### Scenario: Overlay replaces an unsafe admitted preferred row

- **WHEN** the admitted index has a classifier-unsafe zh-CN `canonical_preferred`
  row and the snapshot-bound overlay has a classifier-safe preferred row for
  the same entity
- **THEN** the resolver SHALL use the overlay label and MUST NOT keep both rows

#### Scenario: Overlay omits unsafe alternatives on overlay entities

- **WHEN** an overlay entity also has a classifier-unsafe admitted alternative
- **THEN** context construction SHALL omit that alternative so the reviewed
  preferred label can resolve

#### Scenario: Two preferred rows remain after merge

- **WHEN** merge would leave two zh-CN `canonical_preferred` rows for one entity
- **THEN** context construction MUST fail closed
