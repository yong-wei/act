## Context

The manifest runtime already has separate layout, content, activity, evidence,
and module-gate files under
`src/features/interactive/shared/manifest-runtime/`. The current
`content-renderers.tsx` is nevertheless a large central registry/switch that
imports content cards, control workbench panels, visual stages, simulations,
and other business components. `layout-renderer.tsx` and
`activity-renderers.tsx` also carry registry contracts, but their types do not
form one explicit module/activity/layout plugin boundary.

This change is deliberately distinct from the Prisma `TeachingResource`
registry and from the lesson-engine `resource-renderer.tsx` (current lowercase
mainline) and `ResourceRenderer.tsx` (legacy uppercase consumer). It consumes
the canonical module taxonomy, response contracts, generated-slide adapter,
role projection, and existing UI governance; it does not redefine them.

## Goals / Non-Goals

**Goals:**

- Define typed, category-specific plugin contracts for manifest modules,
  activities, and layouts/templates.
- Make validation, lookup, role projection, evidence collection, and missing
  renderer handling the only central runtime responsibilities.
- Move the real `compute.panel`/`static-surface-3d` implementation to an owned
  plugin and remove its direct central import and switch branch.
- Preserve canonical kinds, response semantics, generated-courseware behavior,
  role-safe answer visibility, and optional media/knowledge-card degradation.
- Make plugin ownership, schema, evidence, and deletion conditions auditable.

**Non-Goals:**

- Merging the plugin registry with Prisma `TeachingResource` registration.
- Rewriting every existing renderer in one change or changing manifest payloads
  without a migration contract.
- Replacing the lowercase/uppercase lesson-engine renderer contracts.
- Expanding UI styling covered by `unify-interactive-lesson-component-style`.
- Claiming that all central imports disappear before later migrations.

## Decisions

### 1. Use category-specific typed plugin contracts

Define a shared runtime context and three discriminated contracts, equivalent in
shape to:

```ts
interface ManifestCapabilityPlugin<TPayload, TState, TEvidence> {
  key: {
    moduleKind: string;
    capabilityRef: string;
    contractVersion: string;
  };
  schema: (payload: unknown) => TPayload;
  projectRole: (payload: TPayload, role: 'student' | 'teacher') => TPayload;
  render: (input: RendererProps<TPayload, TState>) => ReactNode;
  extractEvidence?: (state: TState) => TEvidence[];
  missingRenderer: MissingRendererContract;
}
```

The registry key is the full tuple `(category, moduleKind, capabilityRef,
contractVersion)`. `moduleKind` and `capabilityRef` are both non-empty stable
identifiers; the version is explicit so a single `compute.panel` kind can
register `static-surface-3d`, `control-workbench`, and `interactive-figure` as
different capabilities. Activity plugins additionally declare response kind,
submit behavior, and durable evidence classification. Layout plugins declare
template/region behavior and do not receive answer-bearing payloads unless
their contract explicitly projects a role-safe view. The exact interfaces may
be split into module/activity/layout types, but every entry must expose the
stable key, schema, role projection, render behavior, evidence metadata, and a
typed missing-renderer contract.

The missing-renderer contract belongs to the plugin/category contract: it
declares whether absence is required or optional, the machine-readable marker,
and the observable diagnostic shape. The central runtime may emit that typed
result for an absent key, but it never infers capability behavior from a string.

One untyped `Record<string, Function>` was rejected because it lets a plugin
skip validation or leak teacher reference answers. A plugin class hierarchy was
rejected because it would couple pure contract data to React lifecycle state.

### 2. Compose registries from owned plugin sets

The center accepts a registry assembled from owned plugin sets. Domain/plugin
files own payload validation, role projection, evidence, and missing-renderer
behavior; the runtime only resolves the exact registered key and passes the
normalized context. Registry construction rejects duplicate composite keys,
unknown categories, missing capability references, and plugins without an owner
or contract version. Two capabilities under one `compute.panel` module kind
remain distinct registry entries. A new course adds manifest data and, when
needed, a plugin set; it does not add a branch to `content-renderers.tsx`.

The pilot moves the actual `static-surface-3d` renderer implementation into an
owned plugin module registered under the `compute.panel` plus
`static-surface-3d` key (not a forwarding facade), then passes that plugin set
into the shared runtime. The central file must no longer import that
implementation or parse the capability reference.

### 3. Validate once, project by role, and fail visibly when required

The runtime validates a module payload at the manifest boundary, normalizes it
to a trusted plugin input, and invokes the selected plugin's schema and
student/teacher projection before rendering. Teacher-only reference answers,
diagnostics, or controls are removed by the plugin's projection contract;
student output cannot opt out. Evidence extraction and missing-renderer
semantics are also owned by that plugin contract.

When a required composite key has no plugin, the center returns the typed
missing-renderer result for that contract/category and a machine-readable error
for governance. Optional modules may be omitted with an observable reason. The
center does not parse `capabilityRef`, inspect capability names, or retain a
capability-specific branch. An unregistered key never falls through to a
plausible content card, because that would hide a broken contract and can
expose the wrong evidence semantics.

### 4. Keep evidence extraction separate from visual rendering

A plugin may declare a typed evidence extractor for state that the shared
submission controller can associate with a manifest step. Passive view/focus
events remain `InteractionLog` evidence according to the existing contracts;
only an activity plugin with a registered response contract can produce
`StudentStepResponse` or LearningFact materialization input. Rendering must not
write evidence as a side effect.

### 5. Adapt generated courseware without a second registry

The existing generated-slide adapter projects generated modules into canonical
manifest kinds and invokes the same plugin registry with student/teacher role
projection. Generated publication revision/hash checks remain in the
courseware contract. No generated-specific central switch is introduced.

### 6. Keep DB resources and lesson-engine resources separate

The manifest registry owns `module.kind` and activity/layout plugin contracts.
The Prisma `TeachingResource.registryId` remains the DB/BOPPPS resource
registry; it may provide a resource to a plugin through a public capability, but
it is not itself a manifest plugin entry. The lowercase lesson-engine
`resource-renderer.tsx` remains the current resource shell, and legacy uppercase
consumers are handled only by the later retirement change.

## Denominator and Characterization

Freeze all canonical and legacy manifest kind/capability pairs, capability
versions, activity response renderers, layout/template entries, direct imports
and switch branches in `content-renderers.tsx`, role projections, evidence
extractors, generated-slide adapters, missing-renderer contracts, and
runtime-first manifests. Include all 32 runtime-first families and generated
manifests; report DB `TeachingResource` entries separately. Capture the
pilot's HTML markers, role visibility, fallback/error behavior, submission
payloads, optional media/card behavior, and duplicate-key rejection.

## Vertical Migration and Deletion

First add the typed registry alongside existing behavior, then move the
`static-surface-3d` implementation and update its callers/tests. Remove the
pilot's central direct import and dead branch in the same qualified slice. Any
temporary adapter must have an owner, contract version, consumer denominator,
and deletion condition. Additional plugin migrations are separate slices; no
permanent facade or DB registry merge is allowed.

## Targeted and Domain Verification

Run plugin type/schema tests, composite-key duplicate/unknown registry tests,
same-kind/different-capability registration tests, module taxonomy and
course-data-quality gates, role-projection and reference-answer leakage tests,
missing required/optional renderer tests, evidence extraction tests,
generated-slide tests, and central direct-import/capability-parser inventory
checks. Then run the affected Interactive domain suite, typecheck, lint, and
`openspec validate introduce-manifest-runtime-plugin-contract --type change
--strict`, followed by `git diff --check`.

## Browser Acceptance

Render the pilot module in student and teacher views and compare its
characterization markers and visible controls. Verify student output contains
no reference answer or teacher-only diagnostic, required missing plugins show
the explicit error marker, optional media/card failure leaves the base step,
and a new manifest can use the plugin without a central switch edit or
capability parser. A registry negative test must reject a duplicate full key
while accepting distinct `compute.panel` keys for `static-surface-3d`,
`control-workbench`, and `interactive-figure`.

## Ledger

Maintain a plugin ledger with category, `moduleKind`, `capabilityRef`, owner,
schema/contract version, role projection, evidence classification,
missing-renderer contract, source implementation, central import count,
consumers, migration state, deletion condition, and unit/browser evidence.
Maintain a separate record proving no `TeachingResource` or
lesson-engine registry entry was silently reclassified as a manifest plugin.

## Migration Plan

1. Verify the qualified charter/dependency inputs and existing taxonomy,
   response, generated-slide, and UI governance capabilities.
2. Freeze the module/renderer/import denominator and capture pilot behavior.
3. Implement typed registry composition and typed missing-renderer handling
   without changing existing manifests; the center resolves the composite key
   but does not parse capability references.
4. Move `static-surface-3d` as a real plugin, delete its central import/branch,
   and run role/evidence/browser gates.
5. Publish the plugin ledger and use it as the input to the shared classroom
   pilot. Broader renderer migration remains subsequent work.

Rollback can restore the pilot implementation behind the same registry contract
before its deletion receipt is accepted; it must not reintroduce a second
central authority or change the DB resource registry.

## Open Questions

None blocking. The implementation may choose the exact plugin directory and
schema-validation helper already approved by the repository, but it must retain
typed categories, role-safe projection, evidence metadata, and the central
import deletion proof.
