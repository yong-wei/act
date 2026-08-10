## Context

This change follows the independent Authority boundary and versioned Authority Snapshot. ACT must project only objects actually used by its courses and resources. ActKG engineering relations remain upstream data; teaching roles and prerequisites are ACT-owned.

## Series Dependencies

- Depends on: `revise-actkg-authority-boundary`, `activate-versioned-actkg-engineering-authority`.

## Goals / Non-Goals

**Goals:**

- Define one deterministic authoring-to-runtime Teaching Projection identity.
- Make resource bindings explicit and scope-local, with typed roles and projection modes.
- Allow empty projections and independent consumer combinations.
- Make every gate fail closed without converting unrelated engineering objects into ACT review work.

**Non-Goals:**

- Do not migrate existing course resources,教材 locators, prerequisites, or cards here; those are later changes.
- Do not infer teaching edges from ActKG engineering predicates, section order, or aggregate CourseCoverage.
- Do not add Prisma storage or an in-app editor.

## Decisions

### 1. Authoring and runtime directories

Authoring lives under `course-content/authoring/knowledge/` and contains resource bindings, prerequisites, core-node declarations, card metadata, and legacy crosswalk inputs. Generated runtime lives under `course-content/runtime/knowledge/projection/` and includes immutable projection release directories plus a current pointer. Runtime files are never hand-edited.

### 2. Stable identity and roles

Resource IDs are deterministic: `act:lesson:<lesson-key>`, `act:handout:<lesson-key>`, `act:step:<lesson-key>:<step-id>`, `act:textbook:<source-document-id>`, `act:textbook-section:<section-id>`, and `act:card:<stable-card-id>`. Binding identity is `resourceId + canonicalId + role + scopeId`. Roles are exactly `COVERS`, `EXPLAINS`, `PRACTICES`, and `ASSESSES`.

### 3. Projection mode and gate

Every in-scope resource declares `REQUIRED`, `OPTIONAL`, or `NONE`. `REQUIRED` must have at least one valid binding; `OPTIONAL` may remain unbound; `NONE` carries no knowledge semantics. Invalid Canonical IDs, retired nodes without successor, unresolved required cards, duplicate active cards, and invalid prerequisite endpoints/cycles fail the projection. Unprojected Authority nodes and absent optional cards do not.

### 4. Artifact set

Each build emits deterministic `resources.jsonl`, `bindings.jsonl`, `prerequisites.jsonl`, `core-nodes.json`, `cards-index.json`, `projection-manifest.json`, and `impact-report.json`. The manifest binds Authority release identity, authoring revision, source hashes, projection ID/hash, scope, counts, and gate result. Impact report lists local affected records, not all upstream nodes.

### 5. Consumer combinations

`activation.json` maps each consumer to an explicit `authorityReleaseId` and optional `projectionId`. Engineering-only consumers may omit projection; teaching consumers require a projection and may pin an older valid combination. A projection can be empty and still have a valid hash.

## Risks / Trade-offs

- File artifacts duplicate indexes at build time, but deterministic immutable directories make rollback and review auditable.
- Explicit `NONE` increases authoring work but prevents false missing-binding failures for navigation/transition steps.
- Projection IDs can proliferate when consumers pin versions; activation metadata remains the single combination registry.

## Migration Plan

Introduce schemas, builder, and fixture tests first. Generate an empty projection and a synthetic bound fixture without changing existing course readers. Later changes populate resources and migrate consumers incrementally.

## Open Questions

None. Resource role and mode vocabulary is fixed for the first version.
