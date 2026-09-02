## Context

The canonical manifest content renderer is a large TSX module that renders
content blocks and activity cards, normalizes payload fields, handles math and
response prefills, and delegates registered capabilities.  C13 makes the
typed plugin registry the only reusable capability authority; this change
operates on the resulting canonical implementation rather than preserving
legacy branches.

The `code-simplification` skill requires understanding responsibility, callers,
edge cases, and historical intent before editing; behavior must be preserved
and tests must not be weakened to make the refactor pass.

## Goals / Non-Goals

**Goals:**

- Make the canonical renderer easier to read, reason about, and modify.
- Remove actual duplicate logic and accidental control-flow complexity.
- Preserve exact rendered output, role privacy, evidence semantics, and
  required/optional failure behavior.
- Produce an auditable before/after simplification record.

**Non-Goals:**

- Adding a renderer framework, new plugin contract, generic abstraction, or
  second dispatch path.
- Rewriting course manifests, changing content semantics, or fixing unrelated
  visual styling.
- Splitting the file into smaller files without reducing reasoning complexity.
- Moving submission/evidence authority into the renderer.

## Decisions

### 1. Establish a behavior baseline first

Before editing, record representative content-block, activity-card, structured
response, math, prefill, teacher, student, missing-field, optional-resource,
required-capability, and error outputs.  Record callers and use `git blame` or
equivalent history for non-obvious branches.

### 2. Apply targeted simplification patterns

Use guard clauses for nested conditions, named predicates for repeated role or
payload checks, named intermediate values for card/module selection, and one
shared pure normalization path where the same field is decoded repeatedly.
Replace duplicated dispatch branches with an explicit mapping only when it
retains exact key and fallback semantics.  Keep a helper when its name conveys
an important concept; do not optimize for line count.

### 3. Keep the plugin and evidence boundary intact

The renderer calls C13's canonical registry for reusable capabilities and
continues to project role-safe payloads before rendering.  Rendering remains
side-effect free.  Only the existing submission controller and evidence path
may materialize response/evidence inputs; no renderer helper writes Learning
Record data or reads live state as an answer source.

### 4. Measure simplification, not file movement

The ledger records before/after line count, function/branch or equivalent
complexity measures, duplicate-pattern inventory, import surface, and changed
behavior cases.  A pure extraction or rename with unchanged reasoning burden
does not satisfy this change.  Any helper extraction must accompany a concrete
reduction in duplicated logic or control-flow complexity.

### 5. Verify incrementally

Make one logical simplification at a time, run the direct renderer tests, then
the manifest/plugin and affected Interactive suites.  If an output, error,
role, or evidence case changes without an approved contract decision, revert
that simplification and reconsider it.

## Risks / Trade-offs

- [A compact dispatch hides a missing-renderer distinction] → retain explicit
  required/optional/unclaimed results and test each state.
- [Normalization changes student or teacher payloads] → compare serialized
  role projections and representative DOM markers before and after.
- [A helper extraction becomes a second authority] → keep one canonical call
  path and require import/caller inventory evidence.
- [Line count falls while comprehension worsens] → use named concepts and
  review the before/after complexity record; reject clever dense expressions.

## Migration Plan

1. Freeze behavior, caller, and complexity baselines after C13.
2. Simplify one identified duplication/control-flow smell at a time, preserving
  public imports and plugin/evidence boundaries.
3. Run focused tests after each logical change and retain the passing checkpoint.
4. Compare whole-module behavior and metrics, then record the final ledger.
5. Roll back an individual simplification if behavior or comprehension worsens;
  no data or runtime identity migration is involved.

## Open Questions

None.  The implementer chooses the smallest clear transformation supported by
the baseline evidence; no target line count is prescribed.
