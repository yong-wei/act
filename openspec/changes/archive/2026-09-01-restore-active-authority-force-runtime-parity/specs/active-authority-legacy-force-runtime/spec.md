## ADDED Requirements

### Requirement: Ordinary active nodes remain under live force ownership
Ordinary domain and neighborhood nodes SHALL enter the shared Force Graph runtime as movable seeded nodes. Automatic layout code MUST NOT assign `fx`, `fy` or `fz`; fixed coordinates are reserved for governed root packing and explicit user pins.

#### Scenario: Domain overview settles
- **WHEN** a bounded concept overview enters 2D or 3D
- **THEN** force ticks SHALL move at least one unpinned node and separate collisions before settlement
- **AND** the resulting coordinates SHALL remain within the configured time and viewport budgets

#### Scenario: User pins and unpins a node
- **WHEN** the user drags a node to a fixed location and later removes the pin
- **THEN** only the explicit pin SHALL own fixed coordinates while active
- **AND** unpinning SHALL return the node to force ownership without resetting unrelated nodes

### Requirement: Force reflow is bounded and behaviorally verified
Reflow SHALL reheat the current bounded force scope, preserve user pins, settle under explicit tick/time budgets and update camera fit only after a valid layout milestone. Tests MUST verify movement and settlement and MUST NOT accept zero-tick source-string assertions as parity evidence.

#### Scenario: One-hop nodes arrive
- **WHEN** a selected concept loads a bounded neighborhood
- **THEN** only the affected connected scope SHALL reheat and settle
- **AND** filters, selection, camera and unrelated coordinates SHALL remain stable

#### Scenario: Reflow is requested
- **WHEN** the viewer chooses reflow
- **THEN** the runtime SHALL produce a newly settled movable layout within budget
- **AND** it SHALL not merely regenerate the same fixed automatic anchors
