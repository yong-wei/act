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
  - 终局 live run `live-2039d-evidence-supply`（Qwen/Qwen3.5-35B-A3B@siliconflow，gitRevision `b3afa453a`，bank v2，108/108，aggregate complete）：precision 69/72=95.8%（阈值 90% ✅）；伪/未分配编号 0（✅）；coverage 总体 69/88=78.4%（阈值 85% ❌），分意图 code-debugging/concept-comparison/formula 100%、normative 75%、fact-explanation/open-ended 66.7%（阈值 70% ❌）。
  - 归因（不放宽口径）：18/18 题全部章节分配成功（供给完整，无 unassigned、无检索空），全部缺口 missReason 为 `no-marker`——模型未在必需行上落引用标记，属模型引用纪律而非证据供给；补证按 review 裁决改为仅换源重绑（19 unresolved / 17 not-needed，无机械追加制造的覆盖）。此前 100% coverage 由追加式补证制造，已按 review 修正语义后如实下降。
  - 迭代轨迹：3a6f45a43（precision 72.5%）→ 464f49aa0（95.1%，code-debugging 供给断点）→ f699aae46（行式切分后四项达标但补证仍含机械追加）→ b3afa453a（换源重绑语义，诚实指标）。四轮 run 快照均在本地 artifacts。
