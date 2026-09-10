## ADDED Requirements

### Requirement: Runtime-only ship GLBs prefer OSS then the app image
The system SHALL request each `ACT_RUNTIME_ONLY` ship LOD from
`https://static.adapt-learn.online/model-releases/<packageId>/v<version>/<file>`
first. Object keys live in bucket `act-course-models` under `model-releases/`
and MUST preserve the package directory so relative `../textures/<sha>.png`
URIs resolve. The preferred candidate is that public URL. The shared loader SHALL first-paint
the same-origin path `/assets/model-releases/<packageId>/v<version>/<file>` and
MAY switch to the public URL only after a short HEAD probe succeeds. The loader
MUST NOT call `useGLTF` on the public host before the probe succeeds. If the
public origin is unreachable, runtime SHALL stay on the same-origin copy. The
legacy single-file registry MAY follow as the final service fallback. Prior
versioned packages MUST NOT appear in the fallback chain. The Authority bucket
`act-course-assets` MUST NOT be used as origin.

#### Scenario: Published package is available
- **WHEN** the activated LOD is requested and the public origin answers HEAD
- **THEN** the shared loader MAY switch from the same-origin copy to the static
  `model-releases` URL
- **AND** the simulation SHALL remain usable if the static origin is unavailable

#### Scenario: Published package is unavailable
- **WHEN** the public origin does not answer HEAD or later fails to fetch
- **THEN** the loader SHALL keep or return to the same-origin model-release URL
- **AND** if that also fails, it SHALL fall back to the registry single-file chain
