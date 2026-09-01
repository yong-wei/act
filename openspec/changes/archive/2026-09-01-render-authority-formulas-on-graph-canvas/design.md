## Context

The v0.37 formula-render index contains a record for every Formula object in the active domain shards. Domain and neighborhood public objects, however, carry only a `richTitle`; Formula objects have no `statement_text` rich title and therefore receive `state: missing`. The actual `mathematics` projection is attached only to node detail, so the canvas has no governed expression to render.

## Goals / Non-Goals

**Goals:**

- Project formula mathematics into every bounded canvas-visible Formula object.
- Keep the expression bound to the active release, locale and render contract.
- Use the shared cached KaTeX DOM layer in 2D and 3D.
- Preserve a bounded human title for search and accessibility.
- Prove complete Formula denominator coverage and no raw source exposure.

**Non-Goals:**

- Guessing mathematics from prose labels or delimiters.
- Editing or repairing upstream formula content in ACT.
- Returning the complete formula-render index to the browser.
- Adding per-node detail requests or per-frame KaTeX work.

## Decisions

### 1. Formula canvas projection is an explicit shard field

Materialization attaches a public governed formula projection only to Formula objects included in an overview follow-on, search result or neighborhood. It contains render identity, safe LaTeX projection, display mode, accessible label and bounded unavailable state; raw original fields remain server-side.

Alternative rejected: reuse `richTitle`. Formula object names and formula expressions are different semantic fields, and the current release contains no Formula `statement_text` title projection.

### 2. Formula glyph identity combines expression and human context

The canvas label renders the expression as primary content. The governed human label remains available as secondary accessible/search context and in the inspector. Both move and hide under one LOD decision.

### 3. KaTeX content is cached by immutable render identity

The shared semantic label layer renders once per formula render key and locale. Force and camera frames update position, visibility and opacity only. 2D and 3D share content but keep independent coordinate projections.

### 4. Coverage is exact and fail closed

Qualification compares every reachable Formula object against the same-release formula-render denominator. Missing, unsafe, cross-release, unknown-macro or unreviewed unavailable records block the target candidate rather than falling back to prose-only canvas output.

## Risks / Trade-offs

- [Long formulas exceed label bounds] → Use governed wrapping/scale bounds and disclose full content in the inspector without replacing the canvas with raw text.
- [Formula DOM increases label cost] → Materialize Formula nodes only on demand and cache by immutable render key.
- [Locale switch races formula content] → Bind render key to locale qualification and atomically replace the label projection.
- [Unavailable formula hides topology] → Keep the semantic node with a reviewed bounded unavailable label only when the exact disposition allows it.

## Migration Plan

1. Add a real-data regression proving 1,242 Formula nodes have render records but zero canvas mathematics.
2. Extend sealed object/public contracts and formula denominator validation.
3. Connect projection through active model, search, hover and semantic label layer.
4. Add 2D/3D, bilingual, LOD, accessibility, cache and security tests.
5. Rebuild affected bounded shards without changing Authority topology or selectors.

## Open Questions

None.
