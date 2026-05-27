## 1. Status Model

- [x] 1.1 Define status categories for confidence, source coverage, privacy, replay, protocol, official/preview evaluation, readiness, and fallback states.
- [x] 1.2 Define compact chip, inline explanation, detail panel, audit row, empty state, and error state rendering contracts.
- [x] 1.3 Map status categories to platform design tokens.

## 2. Integration Rules

- [x] 2.1 Define how simulation/Arena evidence contracts feed status UI without redefining evidence semantics.
- [x] 2.2 Define how learner state, paths, Konling, ResourceNode audits, and experiments expose status to the shared primitives.
- [x] 2.3 Add role-scope rules for student-visible, teacher-scoped, admin-scoped, audit-only, and system-internal details.
- [x] 2.4 Add rules that shared status primitives may map governed payloads to UI but may not derive domain truth or bypass feature-owned policy checks.

## 3. Validation

- [x] 3.1 Add tests for status labels, tone mapping, role-scoped detail visibility, and low-confidence fallback rendering.
- [x] 3.2 Validate with `rtk proxy openspec validate standardize-platform-status-and-evidence-ui --strict`.
