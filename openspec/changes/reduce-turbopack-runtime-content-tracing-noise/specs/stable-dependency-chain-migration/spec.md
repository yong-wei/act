## ADDED Requirements

### Requirement: Turbopack runtime content tracing is bounded
The project SHALL keep Next.js 16 Turbopack builds on the default build path while constraining runtime content filesystem tracing to explicit production content roots.

#### Scenario: Turbopack build is reviewed after dependency migration
- **WHEN** a follow-up build-quality change addresses Turbopack runtime content warnings
- **THEN** `next build` through the project build script SHALL complete without dynamic filesystem tracing warnings for course runtime content
- **AND** the change SHALL NOT switch the default build path back to webpack unless a documented Turbopack blocker remains.

#### Scenario: Runtime content paths are resolved through fixed roots
- **WHEN** server code reads lesson JSON, graph overlays, handout markdown, media indexes, interactive manifests, or MDX content
- **THEN** those reads SHALL resolve through validated `content` or `course-content/runtime` roots
- **AND** project-root-relative arbitrary paths SHALL be rejected before filesystem access.

#### Scenario: Standalone output is reviewed
- **WHEN** the standalone production build is generated
- **THEN** traced files SHALL include required runtime content for representative course and MDX routes
- **AND** standalone output SHALL exclude non-runtime directories such as authoring sources, tests, docs, OpenSpec changes, local notes, and source build workspaces unless a route explicitly requires them.

#### Scenario: Runtime behavior is preserved
- **WHEN** runtime tracing noise is reduced
- **THEN** representative interactive course entry pages, teacher and student course routes, knowledge card MDX rendering, handout print, and PDF export SHALL continue to render or return valid outputs.
