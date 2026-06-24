## 1. Runtime Context

- [x] 1.1 Add knowledge node and capability target context to supported Konling modes where server-owned context is available.
- [x] 1.2 Add answer intent classification metadata for fact, diagnosis, path, grading, and media guidance responses.
- [x] 1.3 Preserve role, owner, class, resource, path, and privacy scope.

## 2. Citation Guardrails

- [x] 2.1 Require verified content citations for fact explanations.
- [x] 2.2 Require both content and learner/path/evidence citations for personalized claims when evidence is available.
- [x] 2.3 Add fallback states for missing knowledge/capability context or insufficient citation support.

## 3. Verification

- [x] 3.1 Run targeted Konling runtime and citation tests.
- [x] 3.2 Run `openspec validate ground-konling-knowledge-capability --strict`.
