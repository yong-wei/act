## Why

The full React Doctor scan reports four Security category warnings on owned product surfaces: two `dangerouslySetInnerHTML` usages and two iframes without sandbox attributes. These warnings are few enough to remediate explicitly and should not remain buried inside thousands of advisory diagnostics.

This change clears React Doctor Security category warnings while preserving theme initialization, print styling, review embeds, and lesson media preview behavior.

## What Changes

- Repair or explicitly constrain the two `dangerouslySetInnerHTML` usages:
  - `src/app/layout.tsx`
  - `src/app/interactive-learning/lessons/[lessonId]/handout-print/page.tsx`
- Add safe iframe sandbox policy for:
  - `src/app/review/adaptive-assessment-figures/page.tsx`
  - `src/features/interactive/shared/lesson-entry-media-hub.tsx`
- Add tests or static guards for approved inline-script/style and iframe sandbox usage.
- Validate against the owned-surface React Doctor Security category gate introduced by `react-doctor-owned-surface-gates`.

## Capabilities

### New Capabilities

- `react-doctor-security-surface-safety`: Defines security warning remediation requirements for inline markup and iframe surfaces reported by React Doctor.

### Modified Capabilities

- None.

## Impact

- Affects root layout theme initialization, lesson handout print page styling, adaptive assessment figure review embeds, and interactive lesson media iframe previews.
- Depends on `react-doctor-owned-surface-gates` for stable Security category validation.
- Does not address non-security advisory warnings.
