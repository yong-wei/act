## 1. Per-unit source allocation (generation-time)

- [x] 1.1 Add the deterministic allocation module that maps each `evidence-required` section of the intent contract to at least one directly supporting source from retrieval candidates, reusing the relevance-basis whitelist and per-citation-target dedup.
- [x] 1.2 Scale retrieval budget by required-section count inside the allocation layer without changing the global `konling-answer` profile defaults; route all candidates through the existing answer-relevance gate.
- [x] 1.3 Assign citation display numbers via `assignKonlingCitationDisplayNumbers` and carry `KonlingCitationIdentity`, `citationTargetId`, locator info and `sourceRevision` into the generation context.

## 2. Prompt binding contract

- [x] 2.1 Upgrade the prompt builder from a global citation list to a per-unit mapping (section title → assigned citation numbers) for answers with evidence-required sections, keeping the "one source may back multiple units" rule explicit.
- [x] 2.2 Keep plain and enhanced baseline arms free of citation capability; verify their prompts are unchanged.

## 3. Post-generation bounded repair

- [x] 3.1 After generation, measure coverage gaps with the existing scan/audit caliber (`scanKonlingAnswerUnits` + direct-support whitelist).
- [x] 3.2 Perform at most one bounded repair pass per answer (alternate-source remap + rewrite of the unbound unit lines); record the repair round and outcome in the citation snapshot.
- [x] 3.3 When repair fails, keep the #2017 fail-closed downgrade (`[引用缺口：…]`) and never fabricate markers to raise coverage.

## 4. Fair experiment evidence assembly parity

- [x] 4.1 Add citationContext to the full-feature runtime context using the same allocation module and whitelist judgments as production.
- [x] 4.2 Make the live entry freeze real citations instead of `undefined`; make the fixture assemble multi-source evidence through the same module instead of the static four-citation script.
- [x] 4.3 Keep provenance closure: `gitRevision` per record, manifest payload hash, and mixed-configuration rejection unchanged.

## 5. Per-intent failure reporting

- [x] 5.1 Export miss-reason buckets by intent (code-debug / open-explain / normative at minimum) into the official summary so overall averages cannot mask a failing intent.

## 6. Verification

- [x] 6.1 Unit regressions: multi-unit multi-source allocation, single source backing multiple units, retrieval empty, repair failure, source-revision drift.
- [x] 6.2 Contract tests: baseline arms unchanged (no citation capability, 0/0 → N/A), code-block/subscript marker distinctions preserved, normative answers never upgrade unverified sources to verified.
- [x] 6.3 Run typecheck, focused vitest suites, strict OpenSpec validation, and `git diff --check`.
- [ ] 6.4 Re-run the three-arm fair experiment; report overall and per-intent precision/coverage against the acceptance thresholds (85% overall, 70% per intent, 90% precision, zero unassigned/fabricated numbers) and archive this change after merge with the run summary recorded in the Issue/PR.
