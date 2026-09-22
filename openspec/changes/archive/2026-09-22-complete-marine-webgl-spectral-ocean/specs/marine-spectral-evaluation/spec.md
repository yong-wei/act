## ADDED Requirements

### Requirement: Spectral resolution preserves physical sea state
Spectral generation SHALL preserve declared energy, direction and frequency coverage when only numerical resolution changes.

#### Scenario: FFT resolution changes
- **WHEN** The same physical band and target sea state use 128, 256 and 512 samples
- **THEN** Measured Hs remains within the declared normalization tolerance rather than scaling with inverse sample count.

### Requirement: GPU ocean outputs have independent numerical validation
Implemented spectral candidates SHALL validate actual GPU height and derivative outputs against an independent reference.

#### Scenario: A small GPU transform is checked
- **WHEN** The runner executes a small transform with known modes
- **THEN** Read-back output meets the declared error bounds; a TypeScript stage mirror alone is insufficient.
