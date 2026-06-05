## Context

The report lists code, migrations, resource seeds, provider config, demo data, metrics, video scripts, feedback forms, deployment notes, compliance notes, and architecture diagrams as the final package. This change turns that list into a verifiable engineering artifact.

## Goals / Non-Goals

**Goals:**

- Provide deterministic seed data for a demo course, class, students, resources, learner states, paths, simulation/Arena outcomes, and Konling interventions.
- Provide acceptance scripts that check API availability, feature flags, path generation, node execution, fallback, citation coverage, teacher metrics, and exports.
- Provide review-ready documentation with deployment, rollback, privacy, and evaluation methodology notes.
- Ensure the package can be rerun without corrupting production data.

**Non-Goals:**

- Implementing missing platform features from earlier changes.
- Creating marketing-only material without verification scripts.
- Storing real student data in demo fixtures.

## Decisions

### Decision 1: Demo data is synthetic and resettable

Fixtures should be clearly synthetic, tenant-scoped or demo-scoped, and safe to reset or rerun.

### Decision 2: Acceptance commands are part of the package

The final package must name commands and expected outputs, not only describe a manual script.

### Decision 3: Metrics include methodology

Every exported metric should include numerator, denominator, window, confidence, and data-source notes so reviewers can verify the claims.

## Validation

- Acceptance scripts SHALL run against a local or staged deployment.
- The package SHALL verify learner state, path planning, execution evidence, cited Konling correction, simulation/Arena terminal validation, teacher report, export, and provider configuration.
- `rtk openspec validate prepare-control-correction-evaluation-demo-package --strict` SHALL pass.
