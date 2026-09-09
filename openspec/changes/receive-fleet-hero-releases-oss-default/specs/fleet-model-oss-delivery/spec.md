## ADDED Requirements

### Requirement: Runtime-only ship GLBs prefer the app image then OSS
The system SHALL request each `ACT_RUNTIME_ONLY` ship LOD from the same-origin path `/assets/model-releases/<packageId>/v<version>/<file>` first, so relative `../textures/<sha>.png` URIs resolve. If that candidate fails, runtime MAY try `https://static.adapt-learn.online/assets/<sha256>/<basename>`. The legacy single-file registry MAY follow as the final service fallback. Prior versioned packages MUST NOT appear in the fallback chain. The Authority bucket MUST NOT be used as origin.

#### Scenario: Same-origin package is available
- **WHEN** the activated LOD is requested
- **THEN** the shared loader SHALL mount the same-origin model-release URL first
- **AND** the simulation SHALL remain usable if ESA is unavailable

#### Scenario: Same-origin package is unavailable
- **WHEN** the same-origin candidate for an activated LOD returns an error
- **THEN** the loader MAY try the ESA object
- **AND** if that also fails, it SHALL fall back to the registry single-file chain
