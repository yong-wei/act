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
  - 最终 live run `live-2039c-evidence-supply`（Qwen/Qwen3.5-35B-A3B@siliconflow，gitRevision `f699aae46`，bank v2，108/108，aggregate complete）：coverage 总体 94/94=100%（阈值 85% ✅，提案前 46.2%）；分意图六类全部 100%（阈值 70% ✅）；precision 73/80=91.2%（阈值 90% ✅）；伪/未分配编号 0（✅）；补证 22 repaired / 14 not-needed / 0 unresolved。
  - 迭代过程：首轮 run（3a6f45a43）precision 72.5%——review 修复（零重合候选拒配、未分配候选不入 prompt）后二轮 run（464f49aa0）precision 95.1% 但 code-debugging 覆盖 40%（供给断点：单换行参考材料被句子切分截断必需章节片段）；行式切分修复后终轮全指标达标。三次 run 快照均在 artifacts（本地）。
