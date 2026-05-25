## 1. Status Model

- [ ] 1.1 Define status categories for confidence, source coverage, privacy, replay, protocol, official/preview evaluation, readiness, and fallback states.
- [ ] 1.2 Define compact chip, inline explanation, detail panel, audit row, empty state, and error state rendering contracts.
- [ ] 1.3 Map status categories to platform design tokens.

## 2. Integration Rules

- [ ] 2.1 Define how simulation/Arena evidence contracts feed status UI without redefining evidence semantics.
- [ ] 2.2 Define how learner state, paths, Konling, ResourceNode audits, and experiments expose status to the shared primitives.
- [ ] 2.3 Add role-scope rules for student-visible, teacher-scoped, admin-scoped, audit-only, and system-internal details.
- [ ] 2.4 Add rules that shared status primitives may map governed payloads to UI but may not derive domain truth or bypass feature-owned policy checks.

## 3. Validation

- [ ] 3.1 Add tests for status labels, tone mapping, role-scoped detail visibility, and low-confidence fallback rendering.
- [ ] 3.2 Validate with `rtk proxy openspec validate standardize-platform-status-and-evidence-ui --strict`.
