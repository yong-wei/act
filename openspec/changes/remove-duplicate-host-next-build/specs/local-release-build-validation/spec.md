# Local Release Build Validation

## ADDED Requirements

### Requirement: Production Next compilation has one authority

The local release workflow SHALL execute the complete production Next build exactly once inside the target Linux Docker builder. The host preflight MUST NOT execute `npm run build`, invoke Next compilation directly, or produce a host `.next` tree for the release workflow.

#### Scenario: Build a local release image

- **WHEN** an operator invokes the supported local release build script on a clean committed revision
- **THEN** the host performs bounded input validation without compiling Next
- **AND** the target Linux Docker builder executes the complete production application build
- **AND** only the container output can become the release image

### Requirement: Host preflight retains release input gates

Before Docker execution, the host SHALL validate the committed revision, CourseCoverage input, build-scope runtime provenance, optimized-model assets, Prisma configuration/schema/client generation, and the production TypeScript graph. The workflow SHALL re-check the visible worktree after these validators.

#### Scenario: A host release input is invalid

- **WHEN** any required host input validation fails or changes the visible worktree
- **THEN** Docker execution does not begin
- **AND** no image, provenance sidecar, or cache generation is published

### Requirement: Removing duplicate compilation preserves release guarantees

The workflow SHALL retain container-side Prisma generation, optimized-model validation, TypeScript validation, complete Next compilation, immutable OCI revision labeling, image tar hashing, provenance generation, and atomic shared-cache publication after final success.

#### Scenario: Container compilation fails after host preflight

- **WHEN** the Linux container build fails
- **THEN** the workflow fails closed
- **AND** it preserves the previously published shared cache generation
- **AND** it does not publish final provenance or deploy the image
