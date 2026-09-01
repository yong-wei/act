## 1. Understand and baseline

- [ ] 1.1 Read the canonical renderer's callers, callees, history, and
  adjacent plugin/registry code; record responsibilities and edge paths.
- [ ] 1.2 Capture before metrics: lines, functions/branches or equivalent
  complexity, duplicate patterns, imports, and representative rendered,
  role, missing, and evidence outputs.
- [ ] 1.3 Freeze direct tests for content blocks, cards, math, prefill,
  structured responses, role projection, and required/optional failures.

## 2. Apply code simplification

- [ ] 2.1 Invoke the `code-simplification` skill with the frozen renderer
  behavior, trust boundaries, target family, characterization tests,
  permitted deletion set, and prohibition on adjacent plugin redesign.
- [ ] 2.2 Replace identified nested conditions with clear guard clauses and
  named predicates without changing branch ordering or errors.
- [ ] 2.3 Consolidate repeated payload/card/field normalization into named pure
  helpers only where the baseline proves duplication.
- [ ] 2.4 Simplify dispatch and fallback expressions while preserving exact
  plugin identity, unclaimed, missing, and optional behavior.
- [ ] 2.5 Keep rendering side-effect free and preserve submission/evidence,
  role-safe answer privacy, and live-state boundaries.
- [ ] 2.6 Reject any pure file split, speculative abstraction, or line-count
  optimization that does not reduce reasoning complexity.

## 3. Compare and verify

- [ ] 3.1 Run direct renderer tests after each logical simplification and
  retain a passing checkpoint.
- [ ] 3.2 Compare before/after output, role projections, diagnostics, evidence
  classifications, and public import behavior.
- [ ] 3.3 Record after metrics and a before/after mapping for every
  simplification in the ledger.

## 4. Handoff

- [ ] 4.1 Run manifest/plugin, Interactive domain, typecheck, lint, build,
  strict validation, and `git diff --check`.
- [ ] 4.2 Document retained local helpers, rejected transformations, remaining
  test gaps, and any non-blocking readability risk.
