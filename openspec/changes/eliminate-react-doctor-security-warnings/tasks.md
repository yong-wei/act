## 1. Baseline and Policy

- [ ] 1.1 Re-run the owned-surface React Doctor Security category gate after `react-doctor-owned-surface-gates` is available.
- [ ] 1.2 Confirm the expected four owned-surface warnings and classify each as remediate or explicitly constrained allowlist.
- [ ] 1.3 Define minimum iframe sandbox permissions for review previews and lesson media previews.
- [ ] 1.4 Document any sandbox permission that grants scripts, same-origin, popups, downloads, presentation, or forms; prohibit `allow-scripts allow-same-origin` unless explicitly justified and guarded.

## 2. Implementation

- [ ] 2.1 Repair or constrain `src/app/layout.tsx` theme initialization inline script usage.
- [ ] 2.2 Repair or constrain `src/app/interactive-learning/lessons/[lessonId]/handout-print/page.tsx` print CSS inline style usage.
- [ ] 2.3 Add sandbox policy to `src/app/review/adaptive-assessment-figures/page.tsx`.
- [ ] 2.4 Add sandbox policy to `src/features/interactive/shared/lesson-entry-media-hub.tsx`.
- [ ] 2.5 Add tests or static guards for inline markup, iframe sandbox presence, and sandbox permission rationale.

## 3. Verification

- [ ] 3.1 Run the owned-surface React Doctor Security category gate and confirm zero diagnostics.
- [ ] 3.2 Verify theme initialization and theme switching still work without hydration mismatch.
- [ ] 3.3 Verify lesson handout print page styles still render.
- [ ] 3.4 Verify adaptive assessment review iframe and lesson media iframe previews still render with the sandbox policy.
