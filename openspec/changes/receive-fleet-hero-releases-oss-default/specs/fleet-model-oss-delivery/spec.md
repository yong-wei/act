## ADDED Requirements

### Requirement: Versioned ship GLBs prefer OSS then the app image
The system SHALL request each versioned ship LOD from `https://static.adapt-learn.online/assets/<sha256>/<file>` first. If that candidate fails, runtime MUST load the same artifact from the Docker/app image path `/assets/model-releases/<packageId>/v<version>/<file>`. The legacy single-file registry MAY follow as a final fallback. The Authority bucket MUST NOT be used as origin.

#### Scenario: OSS object is unavailable
- **WHEN** the ESA URL for an activated LOD returns an error
- **THEN** the shared loader SHALL mount the same-origin model-release URL
- **AND** the simulation SHALL remain usable

#### Scenario: OSS object is available
- **WHEN** the ESA URL for an activated LOD succeeds
- **THEN** the scene SHALL render that object
- **AND** it MUST NOT also fetch the image copy unless the ESA candidate later fails
