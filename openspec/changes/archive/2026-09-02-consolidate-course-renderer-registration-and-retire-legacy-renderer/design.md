## Context

The manifest runtime already defines exact composite plugin identity
(`category`, `moduleKind`, `capabilityRef`, `contractVersion`), owned plugin
sets, role projection, evidence behavior, and explicit missing-renderer
semantics.  `content-renderers.tsx` still contains a large central renderer and
the repository retains compatibility exports for older import paths.  Course
step panels also create local `InteractiveModuleRegistry` objects for
course-owned modules.

## Goals / Non-Goals

**Goals:**

- Give every reusable manifest capability one registration owner and exact
  lookup path.
- Preserve role-safe projection, evidence classification, version selection,
  optional/required missing behavior, and current rendered output.
- Retire central legacy branches and entrypoints only after migration evidence.

**Non-Goals:**

- Redefining `manifest-runtime-plugin-contract` or adding new plugin kinds.
- Merging manifest plugins with DB/BOPPPS `resource-registry` entries.
- Removing a course-owned local registry that is not a reusable manifest
  capability.
- Changing CourseBundle, Classroom, session, submission, or evidence behavior.

## Decisions

### 1. The existing typed plugin registry is the global authority

Reusable module/activity/layout capabilities register through owned
`ManifestPluginSet` values and the existing composition/lookup functions.
Central rendering resolves the exact composite identity.  Duplicate keys,
ambiguous versions, unknown categories, and unclaimed declared capabilities
retain the existing fail-closed behavior.

### 2. Keep local course registries explicitly bounded

`InteractiveModuleRegistry<TExtra>` remains available only for a module whose
state or presentation is genuinely course-owned and not a reusable manifest
capability.  A course-local map must not shadow a declared plugin identity or
be reachable from the central fallback for a declared capability.  The
inventory records why each local entry is retained or migrated.

### 3. Preserve role, evidence, and missing-renderer semantics

The renderer continues to validate payloads, project student/teacher views,
keep rendering side-effect free, and hand response-producing work to the
existing submission/evidence path.  Missing required capabilities remain
explicit failures; optional capabilities degrade according to their existing
policy.  No renderer may expose reference answers or teacher diagnostics to a
student.

### 4. Delete the old authority at zero callers

After central consumers and reusable registrations use the typed registry,
remove legacy branches and re-export paths such as the old central renderer
entrypoints where their caller inventory is zero.  Compatibility imports are
not a permanent facade.  A temporary mapping is allowed only within the
qualified migration revision.

### 5. Verify before simplifying

Capture representative ordinary, activity, compute, visual, layout,
role-projected, required-missing, optional-missing, and versioned cases before
changing registration.  Compare output and diagnostic markers after migration,
then run the code-simplification pass in C14 on the now-canonical renderer.

## Risks / Trade-offs

- [A capability is registered twice under different paths] → build a composite
  identity inventory and reject duplicate/shadow entries.
- [A missing plugin silently renders through the old map] → test declared
  required and optional capabilities and fail closed on legacy fallback.
- [A local course module is migrated prematurely] → retain it with an explicit
  owner rationale until a reusable contract exists.
- [Renderer cleanup changes role/evidence output] → compare role projections,
  submission classifications, and missing markers against characterization.

## Migration Plan

1. Inventory central branches, plugin sets, local registries, imports, and
   rendered capability identities.
2. Route reusable registrations through the existing typed registry and migrate
   central lookups without changing plugin keys or contract versions.
3. Remove declared-capability fallthrough and compatibility imports at zero
   callers; preserve justified local course registries.
4. Run C14's simplification pass and record before/after complexity and
   behavior evidence.
5. Roll back before deletion proof by restoring the last registry mapping; do
   not change persisted session, response, or evidence identities.

## Open Questions

None.  A local registry is retained only when its ownership rationale and
  non-shadowing proof are recorded in the migration ledger.
