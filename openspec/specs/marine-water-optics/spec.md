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

