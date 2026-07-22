# Arena Model Formula Rendering Design

## Problem

The Arena challenge detail renders transfer functions with KaTeX, but the model selector prints the plain `display` value. This exposes notation such as `s^2` in the locked-model summary and model cards.

## Design

Use `InlineMath` from the existing `react-katex` dependency in `ArenaModelSelectorPanel`. Prefer each model's authored `latex` value and fall back to its plain `display` value when LaTeX is absent. Apply the same local renderer to the locked summary and all model cards.

The change remains presentation-only. Formula data, model compatibility, selection callbacks, analysis, evaluation, persistence, and APIs are unchanged.

## Alternatives

- Unicode exponent replacement was rejected because it fixes only `s^2` and does not render fractions or grouping correctly.
- A global formula abstraction was rejected because no additional inconsistent Arena surface was found.

## Verification

A focused component test will assert KaTeX superscript markup, plain-display fallback, and an unchanged model-selection callback. Related Arena domain tests, type checking, strict OpenSpec validation, and diff checks complete verification.
