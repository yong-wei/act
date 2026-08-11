## Series Dependencies

- Depends on: `revise-actkg-authority-boundary`, `activate-versioned-actkg-engineering-authority`.

## 1. Contract and schemas

- [x] 1.1 Define authoring schemas for resources, bindings, roles, projection modes, core nodes, prerequisites, cards, and legacy crosswalk references.
- [x] 1.2 Define deterministic runtime artifact schemas and manifest identity fields, including Authority/projection/authoring hashes.

## 2. Deterministic builder

- [x] 2.1 Implement stable resource ID and binding identity derivation for all supported resource types and roles.
- [x] 2.2 Build resources, bindings, prerequisites, core-nodes, cards-index, projection-manifest, and impact-report artifacts in a staged directory.
- [x] 2.3 Add empty-projection, repeated-build, source-drift, and byte/hash determinism tests.

## 3. Gates and activation shape

- [x] 3.1 Implement `REQUIRED`/`OPTIONAL`/`NONE` gate semantics and fail-closed invalid endpoint/card/cycle checks.
- [x] 3.2 Emit per-consumer Authority/Projection combinations without changing existing selectors.
- [x] 3.3 Add fixtures proving unprojected Authority nodes and missing optional cards do not block publication.

## 4. Verification

- [x] 4.1 Run targeted schema, builder, manifest, and gate tests.
- [x] 4.2 Run `rtk openspec validate introduce-versioned-act-teaching-projection --type change --strict` and `rtk openspec validate --changes --strict`.
- [x] 4.3 Verify no Prisma migration, editor, deployment, or upstream engineering semantic review is introduced.
