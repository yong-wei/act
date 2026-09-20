## ADDED Requirements

### Requirement: Surface queries include rendered shoreline and envelope terms
The CPU query for visible water SHALL include the same shoreline attenuation, envelope, horizontal displacement and coordinate transform as the rendered surface.

#### Scenario: Contact is sampled near a shore
- **WHEN** a shoreline reduces the visible wave amplitude
- **THEN** independent GPU-surface and CPU-query measurements satisfy the declared query tolerance at the same world positions and time

### Requirement: Surface error categories are measured separately
Acceptance SHALL distinguish query-to-visible-surface error, geometric approximation error and rigid-hull contact behavior; a combined loose bound SHALL NOT substitute for these measurements.

#### Scenario: A near-field error exceeds its target
- **WHEN** measured query error exceeds the 0.05 metre near-field target
- **THEN** the implementation fixes the sampling or representation and records the result instead of increasing an unrelated omitted-frequency bound to pass
