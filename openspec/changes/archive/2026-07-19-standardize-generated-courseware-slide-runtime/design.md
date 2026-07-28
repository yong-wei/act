## Context

The current manifest has ordered full/half regions and a shared renderer, but generated slide-safe content needs a stricter schema independent of any LLM workflow. This child establishes that reusable runtime contract without changing existing preset manifests.

## Goals / Non-Goals

**Goals:** fixed 16:9 steps, finite templates and slots, size variants, text budgets, generatable allowlist, responsive shared rendering, and deterministic static/browser validation.

**Non-Goals:** AI generation, teacher source handling, editor workflows, publication, preset-course migration, arbitrary coordinates, or new simulations.

## Decisions

### 1. Make one step one slide canvas

Generated manifests use BOPPPS stage to step to module. Each step is one fixed 16:9 online/export page with a registered template and fixed grid.

### 2. Validate occupancy, not area sums

Named slots occupy explicit grid cells. Modules declare registered size variants and compatible slots. Static validation rejects overlap, out-of-bounds, duplicate cells, incompatible sizes, and arbitrary geometry.

### 3. Bound text fitting

Each module type/size has suggested length and readable font bounds. Browser validation may accept bounded shrinking but rejects clipping, scrolling, hidden overflow, formula overflow, or fonts below the minimum. Resolution requires trim, resize, or split.

### 4. Expose a strict generation subset

The schema permits six content classes and six canonical response kinds while retaining existing canonical runtime names. No runtime registration can expand the generation allowlist dynamically.

### 5. Preserve existing manifests

Generated manifests opt into the new slide contract. Existing preset lessons continue through current normalized layouts until a separate migration change.

## Risks / Trade-offs

- [Shared renderer regression] -> Add opt-in schema markers and legacy/preset regression fixtures.
- [Browser measurements vary] -> Pin browser, fonts, viewport, and validator version.
- [Fixed templates reduce expressiveness] -> Prefer predictable presentation and export over free-canvas flexibility in P0.

## Migration Plan

Expand shared types and renderer with opt-in slide metadata, add registries and validators, verify existing manifests unchanged, then allow the editor child to emit only the new contract. No contraction of legacy layout support occurs here.

## Open Questions

None.

## Testing Strategy
Change class: high-risk
Seam status: required
Public behavior: A generated-courseware manifest renders each step as a responsive fixed 16:9 page using only registered layouts, slots, sizes, and modules, and deterministic validators reject unsafe geometry or unreadable content without regressing existing lessons.
Public seam: Shared manifest parser/renderer and fixed-viewport Playwright pages exercised with generated slide fixtures and representative existing preset manifests.
Existing seam reused: Interactive manifest runtime tests, module registry gate, response-contract tests, Playwright integration harness, and existing preset lesson routes.
AC coverage: AC-1: schema and occupancy fixtures verify the stage-step-module hierarchy, 16:9 templates, slots, size variants, text budgets, and exact timing metadata; AC-2: registry and browser fixtures verify the strict allowlist, responsive rendering, role states, and preset compatibility; AC-3: static and pinned-browser failure fixtures verify overlap, bounds, clipping, scrolling, formula width, and minimum readable font checks.
Manual-only acceptance: none
Rationale: The shared parser/renderer is the highest reusable runtime seam consumed by every later generated lesson, and paired browser fixtures verify actual geometry that cannot be proven by schema helpers alone.
