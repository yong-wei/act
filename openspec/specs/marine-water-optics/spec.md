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

