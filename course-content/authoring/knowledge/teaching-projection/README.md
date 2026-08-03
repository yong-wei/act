# ACT Teaching Projection (authoring)

ACT-owned, file-based Teaching Projection authoring inputs for issue #1267.

- **Decision source**: files under this directory and package-level authoring.
- **Runtime output**: generated under `course-content/runtime/knowledge/projection/` (read-only).
- **Builder**: `src/lib/teaching-projection/`

## Schemas

| File | Contract |
|------|----------|
| `schemas/authoring.schema.json` | `act-teaching-projection-authoring/v1` |
| `schemas/runtime-manifest.schema.json` | `act-teaching-projection-manifest/v1` |
| `schemas/activation.schema.json` | `act-teaching-projection-activation/v1` |

## Fixtures

- `fixtures/empty-projection.json` — legal empty projection (Authority nodes remain `NOT_PROJECTED`).
- `fixtures/bound-step-projection.json` — synthetic step binding with optional lesson and `NONE` handout.

## Non-goals

No Prisma tables, in-app editor, remote deployment, or upstream ActKG semantic review in this change.
