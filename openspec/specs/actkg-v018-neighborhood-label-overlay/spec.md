# actkg-v018-neighborhood-label-overlay Specification

## Purpose
Snapshot-bound reviewed zh-CN labels for the 25 v0.18 neighborhood objects whose sealed preferred row is missing or classifier-unsafe.
## Requirements
### Requirement: Reviewed neighborhood labels bind one v0.18 snapshot

The reviewed overlay MUST contain exactly the 25 neighborhood entity IDs that
blocked qualification, each with one `zh-CN` `canonical_preferred` label. Those
IDs are the neighborhood objects whose sealed preferred row is missing or
classifier-unsafe. Every row MUST bind
`ctr:release:control-theory-engineering-v0.18` and the admitted v0.18 snapshot
ID/hash. A snapshot mismatch MUST yield no overlay rows.

#### Scenario: Overlay is loaded for the admitted v0.18 snapshot

- **WHEN** the resolver snapshot matches the overlay release, snapshot ID, and hash
- **THEN** all 25 reviewed labels SHALL be available to label resolution

#### Scenario: Overlay is loaded for another snapshot

- **WHEN** the resolver snapshot is not the admitted v0.18 snapshot
- **THEN** the overlay SHALL contribute zero rows

### Requirement: Overlay labels pass the shipped safety classifier

Each overlay `canonical_preferred` label MUST pass `isSafeAuthorityLabel` for
the object's `canonicalType`. Slash, `A/D` style separators, path-like formulas,
English contract sentences, and machine slugs MUST NOT be admitted.

#### Scenario: A neighborhood object is resolved

- **WHEN** one of the 25 overlay entity IDs is resolved on the admitted snapshot
- **THEN** the primary label SHALL be the reviewed short zh-CN string and SHALL
  be classifier-safe

