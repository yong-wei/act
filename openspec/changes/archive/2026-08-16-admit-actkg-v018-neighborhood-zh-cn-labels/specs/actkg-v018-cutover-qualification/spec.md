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

### Requirement: Neighborhood labels must resolve before shard compose advances

Isolated shard compose MUST resolve classifier-safe zh-CN labels for every
expanded neighborhood object. Overlay-backed labels count as resolved. Unsafe
display names MUST continue to fail closed.

#### Scenario: The 25 reviewed overlay labels are present

- **WHEN** qualification runs against the admitted v0.18 snapshot and overlay
- **THEN** isolated shard compose MUST NOT block on those 25 objects' labels
