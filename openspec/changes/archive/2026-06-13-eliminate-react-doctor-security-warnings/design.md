## Context

The full React Doctor scan reports four Security category warnings:

- `src/app/layout.tsx`: `no-danger` for theme initialization script.
- `src/app/interactive-learning/lessons/[lessonId]/handout-print/page.tsx`: `no-danger` for print page CSS injection.
- `src/app/review/adaptive-assessment-figures/page.tsx`: `iframe-missing-sandbox`.
- `src/features/interactive/shared/lesson-entry-media-hub.tsx`: `iframe-missing-sandbox`.

The first two may be intentional framework-level patterns, but they still need an explicit local contract. The iframe findings should generally be repaired with a sandbox policy unless a route proves it needs a capability and documents why.

## Goals / Non-Goals

**Goals:**

- Reach zero owned-surface React Doctor Security category diagnostics.
- Preserve theme initialization before hydration and print page formatting.
- Add sandbox attributes to iframe embeds with the least privilege needed.
- Add regression tests or static guards for future security warning drift.

**Non-Goals:**

- Do not clean non-security advisory warnings in this change.
- Do not redesign media preview routing.
- Do not remove theme switching or handout print support.

## Decisions

1. **Prefer remediation over suppression.**

   Inline markup should be replaced by safer framework-supported constructs where practical. If a construct must remain, it needs a narrowly scoped allowlist and a test that prevents arbitrary new usage.

2. **Iframe sandbox is default.**

   Product iframes should receive a sandbox policy. Additional permissions such as scripts, same-origin, popups, downloads, presentation, or forms must be justified by the embed use case.
   In particular, implementations must not combine `allow-scripts` and `allow-same-origin` unless the change documents why the embed origin and behavior make that combination acceptable and adds a regression guard for the permission set.

3. **Security gate is separate from advisory warnings.**

   The acceptance signal is the Security category scan, not the full warning count.

## Risks / Trade-offs

- **Theme script timing is sensitive.** Changing root theme initialization can cause flash or hydration mismatch. Verify theme behavior after repair.
- **Sandbox restrictions can break media previews.** Test direct media, iframe preview, and click-to-open paths for lesson media resources.
- **Print styles may need inline delivery.** If inline style remains necessary, constrain the source to static local CSS and guard against user-provided content.
