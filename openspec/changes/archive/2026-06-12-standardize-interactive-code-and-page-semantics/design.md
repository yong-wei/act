## Context

The manifest runtime currently has standard content modules for rich text, formulas, tables, figures, reveal chains, stage maps, activities, compute panels, analytics, and layout support. Code examples have no first-class module, so course authors can only place source code inside ordinary text payloads or private renderers. That makes MATLAB examples hard to audit, hard to style consistently, and easy to treat as generic prose.

Unit 1-1 also exposes non-teaching text in figure areas and can show a generic page interaction status module even when the page has no learner interaction. These are not just copy defects: they indicate that current renderer/gate semantics do not separate teaching content from implementation/platform labels strongly enough.

## Goals / Non-Goals

**Goals:**

- Add `content.code` to the canonical interactive module taxonomy.
- Render MATLAB-style code blocks through a shared code renderer with syntax highlighting and accessible teaching labels.
- Make Unit 1-1 p12 use MATLAB-form code through `content.code`.
- Remove development paths, file paths, generic platform labels, and implementation notes from Unit 1-1 visible page text, especially figure-bearing pages.
- Add a hard gate that fails when a no-interaction page includes or renders a generic page interaction status module.
- Update interactive authoring and implementation skills so future code blocks are not authored as ordinary text.

**Non-Goals:**

- This change does not add a general IDE, executable code runner, or notebook runtime.
- This change does not introduce a new dependency for full language-server parsing.
- This change does not rewrite unrelated Unit 1-1 pedagogy, homework, or knowledge graph content.
- This change does not move React Doctor into the default `npm run test` chain.

## Decisions

1. **Add `content.code` instead of overloading `content.rich`.**

   Code examples carry language, source, explanation, and optional line emphasis. Treating them as rich text hides those semantics from authoring gates and prevents renderer-specific validation. `content.code` keeps source code auditable while preserving content/activity separation.

2. **Implement a small MATLAB highlighter in the shared manifest runtime.**

   The first required language is MATLAB. A small tokenizer is sufficient for keywords, comments, strings, numbers, function calls, operators, and prompts. This avoids adding a broad highlighting dependency while keeping the rendered code visibly distinct from prose.

3. **Keep code modules content-only.**

   `content.code` does not produce learner evidence and does not create an interaction slot. If a page asks students to modify or submit code, that must be represented separately through `activity.workspace` or another response-producing activity.

4. **Gate no-interaction status UI from repository tests.**

   The absence of interaction is a course contract. A non-interactive page must not render a generic "本页互动状态" module, nor should it include a status placeholder whose only purpose is platform bookkeeping. The gate should inspect runtime manifests and relevant renderer output/fixtures rather than relying on manual review.

5. **Fix Unit 1-1 at the authoring/runtime source level first.**

   Visible text defects should be corrected in authoring design/contract and regenerated runtime where possible. Implementation adapters may need updates, but page-level code should not hide bad authoring payloads.

## Risks / Trade-offs

- **Risk: Code highlighting becomes a pseudo-language runtime.** → Keep the renderer intentionally presentational; no execution, linting, or semantic evaluation.
- **Risk: Existing audits fail until skills and taxonomy agree.** → Update design skill, implementation skill, taxonomy tests, and registry tests in the same change.
- **Risk: The no-interaction gate catches legitimate teacher-only controls.** → Scope the gate to generic page interaction status modules on pages whose manifest interaction kind is `none`, while allowing title, knowledge-card, figure, formula, code, and analytics modules.
- **Risk: Unit 1-1 runtime and authoring diverge.** → Run content review/export checks and manifest audit after editing authoring sources.
