## 1. Corpus Contract

- [x] 1.1 Define chunk source types, source refs, display links, span refs, quote hash, privacy class, confidence, and freshness fields.
- [x] 1.2 Define supported corpus families for course content, knowledge cards, runtime handouts, path summaries, diagnosis, grading artifacts, simulation/Arena summaries, and reports.
- [x] 1.3 Document retention, rebuild, and invalidation behavior.

## 2. Retrieval And Verification

- [x] 2.1 Define retrieval service/API contract with role, goal, source-type, and evidence filters.
- [x] 2.2 Define citation verification for chunk existence, access scope, source compatibility, and fake id rejection.
- [x] 2.3 Define display metadata for evidence capsules and click-through links.

## 3. Verification

- [x] 3.1 Add tests for fake chunk id rejection.
- [x] 3.2 Add tests for student, teacher, admin, and service visibility.
- [x] 3.3 Add tests for diagnosis, grading, and Konling citation use cases.
- [x] 3.4 Run `rtk openspec validate build-learning-evidence-rag-corpus --strict`.
