## ADDED Requirements

### Requirement: Numerical-domain decomposition is a real behavior-preserving simplification
The control engine SHALL organize analysis internals by numerical domain while keeping the existing WASM facade and result contracts unchanged. Shared helpers MUST represent identical numerical work, and the completed change MUST reduce duplicated analysis logic or total analysis production code rather than only redistribute it.

#### Scenario: A supported analysis is replayed
- **WHEN** existing analysis characterization cases run against the reorganized implementation
- **THEN** outputs remain within their existing tolerances and errors, non-finite handling, result shapes, and facade entrypoints remain unchanged

#### Scenario: A proposed module only adds forwarding layers
- **WHEN** a proposed extraction moves code but adds pass-through wrappers without removing duplication
- **THEN** the extraction is rejected as completion of this requirement
