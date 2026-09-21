## ADDED Requirements

### Requirement: Spectral point queries match rendered sampling
Spectral point queries SHALL use the current visual time, periodic sampling convention and horizontal displacement convention, with measured error and result age.

#### Scenario: A vessel samples a non-grid position
- **WHEN** The selected spectral surface is queried between vertices
- **THEN** The returned contact height agrees with the actual visible surface within the declared contact tolerance.
