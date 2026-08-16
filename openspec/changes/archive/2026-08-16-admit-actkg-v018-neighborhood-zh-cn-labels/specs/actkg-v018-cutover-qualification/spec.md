## ADDED Requirements

### Requirement: Teaching dual-replay trees are byte-equivalent files

Qualification MUST compare teaching `replay-1` and `replay-2` as independent
directory trees. Missing or empty trees MUST block. Every relative path present
in one tree MUST exist in the other with identical bytes.

#### Scenario: Teaching replay trees are absent

- **WHEN** either teaching `replay-1` or `replay-2` is missing
- **THEN** qualification MUST remain BLOCKED with `teaching-dual-replay-trees-absent`

#### Scenario: Teaching replay trees match

- **WHEN** both trees exist and all shared relative paths are byte-identical
- **THEN** teaching dual-replay SHALL not add a blocker

### Requirement: Neighborhood overlay is a sealed qualification input

The qualification manifest MUST hash the reviewed neighborhood overlay artifact
independently of the sealed 1909-row label index. Publication MUST recompute
that hash from the current overlay contract, merge policy, snapshot binding,
and 25 reviewed labels, and MUST fail closed on drift.

#### Scenario: Overlay labels change after a READY report

- **WHEN** the reviewed overlay contract, merge policy, snapshot binding, or
  any of the 25 labels differs from the sealed qualification hash
- **THEN** runtime publication MUST block with overlay hash drift

### Requirement: Neighborhood labels must resolve before shard compose advances

Isolated shard compose MUST resolve classifier-safe zh-CN labels for every
expanded neighborhood object. Overlay-backed labels count as resolved. Unsafe
display names MUST continue to fail closed.

#### Scenario: The 25 reviewed overlay labels are present

- **WHEN** qualification runs against the admitted v0.18 snapshot and overlay
- **THEN** isolated shard compose MUST NOT block on those 25 objects' labels
