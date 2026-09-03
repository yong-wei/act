## 1. Contract and source inventory

- [ ] 1.1 Extend `AiExperimentItem` with source identity, source kind and verified navigation semantics while preserving student-safe serialization.
- [ ] 1.2 Inventory `SimulationRun`/`SimulationTrace`, `SimulationLog`, `ArenaSubmission` and Odyssey bridge fields; document eligible run kinds and authority mapping in adapter tests.

## 2. Canonical-first server projection

- [ ] 2.1 Read completed current-student `SimulationRun` records with bounded selects and project safe summaries without trace samples.
- [ ] 2.2 Retain legacy `SimulationLog` and Arena fallback coverage only when no canonical activity identity is available.
- [ ] 2.3 Derive source type and preview/official authority from the source contract instead of defaulting non-ethical logs to PID.
- [ ] 2.4 Resolve verified cross-source identities and deduplicate before applying collection limit and total; add same-Odyssey and unrelated-run regression cases.
- [ ] 2.5 Generate source-specific navigation targets and fail closed when the target cannot be verified.

## 3. Student-facing archive

- [ ] 3.1 Render eligible experiment items as accessible links to their verified learning or replay destination.
- [ ] 3.2 Preserve honest preview, invalid, unavailable-navigation and empty states without changing official score or profile semantics.
- [ ] 3.3 Add component/route coverage for canonical runs, legacy fallback, source labels, deduplication and navigation.

## 4. Verification and delivery evidence

- [ ] 4.1 Run focused AI Workshop collection and archive tests, related simulation/Arena contract tests, typecheck and `git diff --check`.
- [ ] 4.2 Run `openspec validate ai-workshop-experiment-archive-lineage --strict` and the affected capability validation.
- [ ] 4.3 Capture clean revision-bound `/ai` evidence at 1440px and 320px, including a populated experiment list and verified navigation behavior.
- [ ] 4.4 Record the final checkpoint, test commands and evidence manifest for review.
