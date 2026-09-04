# simulation-scene-visual-pipeline Delta

## ADDED Requirements

### Requirement: Camera re-anchors when the default camera object is replaced

The shared camera controller SHALL detect when the store's default camera object identity changes after the controller has initialized, and SHALL re-anchor once to the active preset view's framing (including any captured user offset for that view) on the replacement camera. A camera identity change MUST NOT leave the camera stranded at the replacement camera's construction position.

#### Scenario: Default camera is replaced during initial load
- **WHEN** a ship model load suspends long enough that the `makeDefault` camera replaces the store camera after the controller's first frame
- **THEN** the controller SHALL re-anchor the replacement camera to the active preset view's framing
- **AND** the ship SHALL be visibly framed once the model finishes loading

#### Scenario: Camera identity is stable during a session
- **WHEN** no camera identity change occurs after initialization
- **THEN** the controller SHALL preserve existing stay-put, user-offset, and follow-translation semantics without any extra re-anchoring

### Requirement: Model scene cloning preserves skinned bindings

Scene code that clones a loaded model scene containing skinned meshes SHALL use skeleton-aware cloning (three.js `SkeletonUtils.clone` or equivalent) so that bone bindings remain valid in the cloned tree. Plain `Object3D.clone(true)` MUST NOT be used for scenes containing skins.

#### Scenario: Ship model with rigged parts is cloned for mounting
- **WHEN** the destroyer scene or QA assembly clones the ship GLB scene containing hangar door and flag skins
- **THEN** every cloned skinned mesh SHALL reference bones inside the cloned tree
- **AND** the rigged parts SHALL render in their bind or animated pose instead of collapsing or disappearing

### Requirement: Model QA pages frame the complete model

Candidate QA and acceptance pages that mount a versioned model package SHALL configure a camera whose framing covers the model's full bounding box on first frame, either through explicit camera placement or fit-to-bounds logic.

#### Scenario: QA page first frame
- **WHEN** the candidate QA page finishes loading the ship LOD
- **THEN** the complete ship SHALL be visible in the first frame
- **AND** the page SHALL expose the evidence hooks required for automated visual verification
