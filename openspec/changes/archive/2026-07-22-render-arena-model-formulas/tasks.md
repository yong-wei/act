## 1. Regression Test

- [x] 1.1 Add a focused component test proving second-order selector formulas render KaTeX superscripts instead of literal `s^2`.
- [x] 1.2 Cover display-only fallback and the existing compatible-model selection callback.

## 2. Formula Rendering

- [x] 2.1 Render locked and selectable model formulas with inline KaTeX, preferring `latex` and preserving `display` fallback.
- [x] 2.2 Keep model data, compatibility decisions, evaluation, and submission behavior unchanged.

## 3. Verification

- [x] 3.1 Run the focused model-selector test and related Arena domain tests.
- [x] 3.2 Run type checking, strict OpenSpec validation, and diff checks.
