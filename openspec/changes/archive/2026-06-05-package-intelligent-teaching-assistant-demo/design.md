## Context

Active changes already define a control-correction evaluation demo package. This change extends the acceptance story from one path loop to the broader teaching-assistant closed loop: diagnosis, multi-path choice, document grading, teacher report, prep pack, and Konling modes.

## Goals / Non-Goals

**Goals:**

- Provide deterministic synthetic fixtures or fixture instructions for representative students, class, assignments, grading, diagnosis, paths, prep packs, Konling sessions, citations, and exports.
- Provide acceptance scripts or documented checks for student overview, path selection, resource execution, grading workbench, student feedback, teacher report, prep pack, and Konling modes.
- Include methodology, expected metrics, privacy checks, and rollback notes.

**Non-Goals:**

- Storing real student data.
- Replacing feature-specific tests.
- Masking missing dependencies with mocks in production acceptance.

## Decisions

### Decision 1: Demo data is synthetic and resettable

The package should be safe to install, reset, and rerun in local or staging environments without duplicating evidence or leaking real data.

### Decision 2: UI route checks are required

The package is not complete if it only validates APIs. The report explicitly requires product surfaces that can be demonstrated.

### Decision 3: Acceptance verifies privacy and citations

Demo checks must reject raw private data, fake citations, missing evidence claims, and unavailable mode contexts.

## Validation

- Acceptance SHALL verify all major student, teacher, grading, prep-pack, and Konling surfaces.
- Privacy checks SHALL reject real student data, private memory, raw answers, hidden Arena internals, raw traces, and secrets.
- `rtk openspec validate package-intelligent-teaching-assistant-demo --strict` SHALL pass.
