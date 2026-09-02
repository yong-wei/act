## ADDED Requirements

### Requirement: Filter changes preserve force session state
Enabling or disabling any active node type or relation family SHALL preserve coordinates, user pins, force-settlement state, camera, selection, loaded shards and inspector state for every still-visible identity. Filter-only changes MUST NOT restart the entire simulation.

#### Scenario: Viewer toggles one relation family
- **WHEN** one loaded engineering family is hidden and restored
- **THEN** only that family's visible edges SHALL change
- **AND** node coordinates, camera and selected detail SHALL remain stable

#### Scenario: Viewer enables an unloaded family
- **WHEN** the panel requests a missing family shard
- **THEN** the runtime SHALL keep the current graph usable while the bounded shard loads
- **AND** only the affected scope MAY reheat after verified nodes and edges arrive
