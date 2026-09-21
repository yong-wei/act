# marine-water-optics Specification

## Purpose
TBD - created by archiving change implement-marine-water-optics. Update Purpose after archive.
## Requirements
### Requirement: Micro waves change optics without changing motion
Micro-wave normals SHALL be filtered for pixel footprint and SHALL NOT affect authoritative or visual-water hull motion.

#### Scenario: Optical quality changes
- **WHEN** micro-normal detail is reduced
- **THEN** hull pose and base wave state remain unchanged while optical detail degrades gracefully

### Requirement: Optional water passes have bounded explicit consumers
Refraction and planar reflection SHALL allocate and render resources only for enabled consumers and SHALL exclude recursive water and teaching UI.

#### Scenario: Optional optics are disabled
- **WHEN** a deep-water preset disables reflection and refraction passes
- **THEN** no corresponding scene re-render or unused render-target allocation continues

### Requirement: Foam is a lit surface with bounded state
Natural foam SHALL respond to compression and lighting and any persistent foam state SHALL have a bounded resolution and defined decay.

#### Scenario: Illumination changes to a dark preset
- **WHEN** the same foam field is viewed under lower illumination
- **THEN** foam darkens coherently instead of appearing as unlit additive emission

### Requirement: Foam coverage has a persistent source-driven lifecycle
The active water renderer SHALL consume bounded foam history with explicit generation, transport and decay. A repeated shape texture gated only by wave height SHALL NOT satisfy this requirement.

#### Scenario: A natural crest stops producing foam
- **WHEN** its compression source falls below the configured threshold
- **THEN** previously generated foam persists, deforms or advects, and dissipates according to elapsed visual time rather than disappearing with the crest mask

#### Scenario: The local foam domain moves
- **WHEN** the vessel causes a foam-domain recentering
- **THEN** previous foam retains its world-space history and new domain regions are initialized without wrapping old trails to the opposite boundary

### Requirement: Foam detail preserves established wave glitter
Foam detail SHALL avoid conspicuous repeating large stamps and SHALL share scene lighting and fog without erasing the established directional water glitter.

#### Scenario: A fixed-camera comparison is reviewed
- **WHEN** natural and vessel foam are enabled separately and together for a moving sequence
- **THEN** the sequence shows distinct sources and evolving shapes without a rigid periodic pattern sliding across the sea
- **AND** unaffected water retains the accepted sun-glitter appearance

### Requirement: Micro-wave filtering follows projected sampling density
The active micro-wave shader SHALL filter unresolved frequencies using physical-pixel footprint or an equivalent projection-aware measure; camera distance alone SHALL NOT be the complete filter.

#### Scenario: Pixel density or field of view changes
- **WHEN** drawing-buffer resolution or camera field of view changes at a fixed world pose
- **THEN** the optical frequency cutoff follows the new sampling density without changing the interaction wave field

### Requirement: Anti-aliasing retains directional wave glitter
Micro-wave changes SHALL reduce coherent stripe patterns and temporal aliasing while retaining the accepted directional highlight structure.

#### Scenario: The camera moves through a glancing view
- **WHEN** a controlled camera movement crosses near and far water under the same sun
- **THEN** the water avoids conspicuous stripe crawling or a sudden mirror-flat transition and preserves visible natural glitter

### Requirement: Graded reflections include a working high-quality consumer
The reflection feature SHALL include the default shared environment reflection and an explicitly enabled bounded planar-reflection consumer for a suitable high-quality scene.

#### Scenario: Planar reflection is enabled in a supported calm-water shot
- **WHEN** the enabled and disabled versions are compared with the same vessel and camera
- **THEN** vessel reflection changes visibly without recursive water, teaching overlays or UI appearing in the reflection
- **AND** the report records the additional rendering cost and the disabled path releases unused resources

### Requirement: Shallow-water optics have a real depth-aware consumer
At least one active shallow-water layout SHALL render depth-aware absorption and bounded refraction using a documented water-thickness interpretation rather than only a preset color gradient.

#### Scenario: Water depth varies beside the vessel
- **WHEN** the shallow-water camera views an authored shore-depth band with a foreground hull
- **THEN** the estimated water layer depth (authored shore-depth profile over the shore-distance band) drives graded absorption and bounded refraction of water-column content (foam detail and plume edges), and foreground hull edges do not leak unrelated background samples via the hull exclusion
- **AND** disabling the shallow-water consumer stops its extra per-fragment rendering work (the shore-segment loop, absorption and refraction sampling are skipped)

#### Scenario: Physical bottom-texture refraction is out of scope
- **WHEN** the shallow consumer renders
- **THEN** refraction is a bounded visual approximation on water-column content sampling (documented offset cap), not a physical refraction of scene geometry; bottom-texture or refraction render targets remain an explicit upgrade path outside this requirement

