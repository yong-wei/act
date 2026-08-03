# ACT Teaching Projection (authoring)

ACT-owned, file-based Teaching Projection authoring inputs for issues #1267 / #1268.

- **Decision source**: files under this directory and package-level authoring.
- **Runtime output**: generated under `course-content/runtime/knowledge/projection/` (read-only).
- **Builder / migration**: `src/lib/teaching-projection/`

## Schemas

| File | Contract |
|------|----------|
| `schemas/authoring.schema.json` | `act-teaching-projection-authoring/v1` (includes `knowledgeRefs`, `projectionMode`) |
| `schemas/runtime-manifest.schema.json` | `act-teaching-projection-manifest/v1` |
| `schemas/activation.schema.json` | `act-teaching-projection-activation/v1` |
| `schemas/legacy-crosswalk.schema.json` | `act-legacy-id-crosswalk/v1` |
| `schemas/migration-status.schema.json` | `act-active-course-migration-status/v1` |
| `prerequisites/schemas/core-nodes.schema.json` | `act-teaching-core-nodes/v1` (#1270) |
| `prerequisites/schemas/prerequisite-edges.schema.json` | `act-teaching-prerequisite-edges/v1` (#1270) |

## Active-course migration (#1268)

- Inventory: published interactive packages from `INTERACTIVE_LESSON_IDENTITY_REGISTRY` + runtime lesson/handout/manifest digests.
- Mapping order: legacy crosswalk → active card → manifest `knowledgeRefs` → exact normalized label/alias → author semantic decision.
- Statuses: `BOUND` / `EXPLICIT_NONE` / `REVIEW_REQUIRED` with method + evidence; unresolved items block only their course package.
- Crosswalk file: `legacy-crosswalk.jsonl` (readable history; do not write legacy IDs as Canonical endpoints in new authoring).
- Author decisions: `decisions/author-semantic-decisions.jsonl` (optional; keyed by resource + scope + inputDigest).

## Fixtures

- `fixtures/empty-projection.json` — legal empty projection (Authority nodes remain `NOT_PROJECTED`).
- `fixtures/bound-step-projection.json` — synthetic step binding with optional lesson and `NONE` handout.
- `fixtures/migration/mapping-cases.json` — duplicate / split / merge / fuzzy / stale / exact mapping signals.

## Core teaching prerequisites (#1270)

- Authoring: `prerequisites/inventory/core-nodes.yaml`, `prerequisites/inventory/edges.yaml`
- Builder/store: `src/lib/teaching-projection/prerequisites/`
- Engineering relations, textbook order, and lesson order remain candidates only; publication requires ACT evidence or teacher-curation rationale plus one author decision bound to the Authority/Projection capture.

## Non-goals

No Prisma tables, in-app editor, remote deployment, or upstream ActKG semantic review in these changes.
