# Characterization

Inventory captured at `a8af1af1ec02d43cba09f8211e18f0942382a39c`
(`tree e91aafc0fec464c5be656885ac569ac091bf0f50`), claim branch
`define-resource-identity-and-generated-registry-index`.

## 1.1 Dependency-contract input

| Input | Status | Evidence |
| --- | --- | --- |
| `enforce-modular-domain-dependency-contracts` | qualified, archived | `openspec/changes/archive/2026-08-26-enforce-modular-domain-dependency-contracts/` |
| Canonical spec | present | `openspec/specs/modular-domain-dependency-contracts/spec.md` |
| Charter owner for knowledge/resource governance | `knowledge` | `docs/architecture/bounded-context-map.md` |
| Native GitHub blocker | closed | `#1547` CLOSED; `#1589` not blocked |
| New business files in `src/lib` | not used | public API lives in `src/features/knowledge/resource-index/` |

Issue-backed GitHub blocker `#1547` is closed, so the dependency-contract input is
available. Tracking parent `#1588` is not an implementation dependency.

## 1.2 Frozen source surfaces

| Surface | Owner | Count / notes |
| --- | --- | --- |
| Render component registry | `src/lib/resource-registry.tsx` | 133 unique `id` values; React render owner |
| Render metadata table | `src/lib/resource-registry-metadata.ts` | 336 source-owned records via `getAllRegisteredResourceMetadata()` |
| ResourceNode planning registry | `src/lib/resource-node-registry.ts` | derived planning projection; not a second render table |
| Teacher ResourceNode assembly | `src/lib/teacher-resource-node-data.ts` | composes TeachingResource + registered + runtime + projections |
| Field-completion audit | `src/lib/resource-field-completion-audit.ts` | audit projection `resource-field-completion-audit.v1` |
| Path readiness gate | `src/lib/full-resource-path-readiness-gate.ts` | readiness gate `full-resource-path-readiness-gate.v1` |
| Runtime resource projections JSONL | `course-content/runtime/resource-governance/runtime-resource-projections.jsonl` | 6882 lines / 28 564 256 bytes; **derived output, not an index source** |
| Prisma `TeachingResource` | DB registry | independent `id` / optional `registryId` foreign ref |
| Manifest plugin registry | interactive domain | `module.kind` / `capabilityRef`; not this index |
| Lesson-engine renderer | `src/features/lesson-engine/resource-renderer.tsx` | continues to call `getRegisteredResource` |

## 1.4 Frozen consumer behavior (pre-migration)

`GET /api/resources/[id]`:

1. Load Prisma `TeachingResource` by primary key. Hit returns the DB row unchanged.
2. On miss, previously called `getRegisteredResourceMetadata(id)` and projected a
   synthetic TeachingResource JSON when student-visible.
3. Student visibility excluded `teacher-only`, `blocked`, `teacher-assigned`,
   `teacher-scoped`, `teacher_only`, and `archived`.
4. GET itself had no session; the fallback was a student-visible projection.
5. PATCH remains teacher/admin only and writes Prisma only.

Knowledge graph/card/media optional failure remains local to those surfaces
(`resource-node-workspace-contracts`, Authority optional blocks). This change does
not activate knowledge-surface read-contract consumers.

Course/card/media/simulation/textbook/knowledge-node owners stay with their
existing registries. The generated index is a join projection beside them.
