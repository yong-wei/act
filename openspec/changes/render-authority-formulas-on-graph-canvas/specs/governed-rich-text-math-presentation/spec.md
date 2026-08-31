## ADDED Requirements

### Requirement: Materialized Formula nodes carry bounded governed mathematics
Every materialized active Formula node SHALL carry an exact-release governed formula projection suitable for the requested locale and shared strict KaTeX renderer. The projection MUST NOT expose raw original TeX, unbounded sidecar indexes or another release's fallback.

#### Scenario: Formula enters a one-hop network
- **WHEN** an eligible Formula node is returned by bounded search or neighborhood disclosure
- **THEN** its public presentation SHALL include the matching governed formula render projection
- **AND** the projection identity SHALL match the containing shard and locale qualification

#### Scenario: Formula record is missing or unsafe
- **WHEN** a reachable Formula lacks a valid current render record or reviewed unavailable disposition
- **THEN** candidate qualification SHALL fail closed
- **AND** the canvas SHALL not substitute the prose label as if it were the formula

### Requirement: Force motion does not rerender formula content
Formula DOM SHALL be cached by immutable render identity and locale. Force ticks, drag, camera movement and zoom SHALL update only placement, visibility and opacity.

#### Scenario: Formula node moves during reheat
- **WHEN** force or camera state changes the formula's screen coordinates
- **THEN** the cached rendered mathematics SHALL move with the node
- **AND** KaTeX SHALL not execute again solely because coordinates changed
