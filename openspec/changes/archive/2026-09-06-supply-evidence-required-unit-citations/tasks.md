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
- [x] 6.4 Re-run the three-arm fair experiment; report overall and per-intent precision/coverage against the acceptance thresholds (85% overall, 70% per intent, 90% precision, zero unassigned/fabricated numbers) and archive this change after merge with the run summary recorded in the Issue/PR.
  - Live run `live-2039-evidence-supply`（Qwen/Qwen3.5-35B-A3B@siliconflow，gitRevision `3a6f45a43`，bank v2，108/108）：coverage 总体 92/92=100%（阈值 85% ✅，提案前 46.2%）；分意图六类全部 100%（阈值 70% ✅）；伪/未分配编号 0（✅）；precision 72.5%=87/120（阈值 90% ❌）——归因：22 个编号仅落 model-derived 推导章节 + 11 个 semantic-score 分级片段被正文引用，非证据供给缺失（补证 22 repaired / 14 not-needed / 0 unresolved），不放宽口径，模型引用纪律作为后续数据点。
  - Fixture run `fixture-2039-evidence-supply` 同链路复跑通过（coverage 72/72=100%，补证 36/36，missReasons 分意图导出为空桶）。
