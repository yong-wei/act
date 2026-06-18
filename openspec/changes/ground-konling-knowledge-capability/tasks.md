## 1. Runtime Context

- [ ] 1.1 Add knowledge node and capability target context to supported Konling modes where server-owned context is available.
- [ ] 1.2 Add answer intent classification metadata for fact, diagnosis, path, grading, and media guidance responses.
- [ ] 1.3 Preserve role, owner, class, resource, path, and privacy scope.

## 2. Citation Guardrails

- [ ] 2.1 Require verified content citations for fact explanations.
- [ ] 2.2 Require both content and learner/path/evidence citations for personalized claims when evidence is available.
- [ ] 2.3 Add fallback states for missing knowledge/capability context or insufficient citation support.

## 3. Verification

- [ ] 3.1 Run targeted Konling runtime and citation tests.
- [ ] 3.2 Run `openspec validate ground-konling-knowledge-capability --strict`.
