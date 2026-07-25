## MODIFIED Requirements

### Requirement: Knowledge graph expansion motion explains local topology
The knowledge graph SHALL use bounded transition motion for domain entry, an ambient directional flow layer on eligible structural edges, and prominent continuous directional path motion for a selected post-requisite corridor. All continuous motion SHALL be paint-level: node coordinates, deterministic packing, label placement, and hit areas SHALL remain frozen, and no motion SHALL reheat layout simulation.

#### Scenario: Domain view is entered
- **WHEN** a domain's knowledge nodes become visible
- **THEN** the graph MAY use a short bounded transition from the domain center to stable final coordinates
- **AND** the transition SHALL finish promptly without continuous orbit, radial ray, or force-driven drift.

#### Scenario: Ambient flow renders on structural edges
- **WHEN** a domain view is visible and no reduced-motion preference is active
- **THEN** small directional markers SHALL travel along the visible post-requisite structural-foreground edges from source boundary to target boundary, following each rendered path's tangent
- **AND** concurrent ambient markers SHALL be deterministically selected within a documented budget that preserves the performance frame budget
- **AND** ambient markers SHALL use a subdued, family-tinted treatment distinct from the prominent selected-corridor markers
- **AND** shared segments and simultaneous branches SHALL be deduplicated or bounded to avoid visual noise.

#### Scenario: Ambient flow pauses when unseen or unfocused
- **WHEN** the browser tab is hidden, the canvas is outside the viewport, or a domain transition is mid-flight
- **THEN** ambient marker advancement SHALL pause rather than consuming frame budget offscreen.

#### Scenario: Selected path corridor is focused
- **WHEN** a selected knowledge node has eligible canonical prerequisite ancestors or post-requisite descendants
- **THEN** small directional arrows SHALL travel from source boundary to target boundary along the exact rendered straight or curved post-requisite edges
- **AND** each marker SHALL follow the path tangent, disappear at the terminal node, pause, and restart at the path origin
- **AND** corridor markers SHALL remain visually prominent above the ambient flow layer
- **AND** shared segments and simultaneous branches SHALL be deduplicated or bounded to avoid visual noise.

#### Scenario: Path corridor is not focused
- **WHEN** no knowledge node is selected
- **THEN** prominent looping corridor markers SHALL stop while the subdued ambient flow layer MAY continue within its budget
- **AND** static edge and target-arrow semantics SHALL remain available.

#### Scenario: User prefers reduced motion
- **WHEN** `prefers-reduced-motion: reduce` is active
- **THEN** domain interpolation, ambient flow markers, and looping corridor markers SHALL stop or become immediate state changes
- **AND** static focus, edge, endpoint, loading, success, and error states SHALL preserve equivalent meaning.

## ADDED Requirements

### Requirement: Root domain bubbles render with layered vitality

Root domain bubbles SHALL present a layered, lively treatment built from platform tokens: an offset inner highlight, a rim-light arc, a soft outer halo, and a slow breathing glow on the active or hovered bubble. All vitality effects SHALL be paint-level: bubble centers, radii, packing, hit areas, and the always-visible internal full-name labels SHALL remain exactly as the deterministic root layout defines them. A bounded entrance stagger MAY play when the root view mounts and SHALL finish promptly.

#### Scenario: Bubble depth layers render
- **WHEN** the root view is visible in light or dark theme
- **THEN** each domain bubble SHALL render an offset inner highlight, rim-light arc, and outer halo derived from platform tokens
- **AND** the full domain name SHALL remain completely visible inside the bubble with no vitality effect overdrawing the label.

#### Scenario: Active bubble breathes
- **WHEN** a root bubble is active or hovered and reduced motion is off
- **THEN** its halo and glow SHALL pulse slowly within bounded intensity
- **AND** the bubble's geometry and every other bubble's presentation SHALL remain unchanged.

#### Scenario: Root entrance is bounded
- **WHEN** the root view mounts
- **THEN** bubbles MAY appear with a short staggered fade-and-settle sequence that completes within a documented duration
- **AND** after the sequence the presentation SHALL be identical to a re-render of the same state.

#### Scenario: Reduced motion collapses vitality
- **WHEN** `prefers-reduced-motion: reduce` is active
- **THEN** breathing and entrance stagger SHALL be disabled
- **AND** the static layered depth treatment SHALL still distinguish active from inactive bubbles.
