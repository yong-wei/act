## Context

The latest local scans produced two distinct signals:

- Error-only gate: 62 error diagnostics across 37 files.
- Full warning scan: 4,094 diagnostics, including 4 security warnings and 162+ diagnostics under `evaluate/test_repos/*`.

The error-only gate is actionable. The full warning scan is not yet actionable because it includes sample repositories and many advisory rules that are not uniformly meaningful for this product.

## Goals / Non-Goals

**Goals:**

- Create stable local commands that report React Doctor blockers without scanning non-product fixtures.
- Keep error-level diagnostics and security warnings as first-class remediation signals.
- Preserve warning-level output as an evidence artifact for planning, not a default implementation gate.
- Make the scan output easy for Buddy changes to attach as acceptance evidence.

**Non-Goals:**

- Do not suppress real error rules to make the gate pass.
- Do not connect React Doctor to GitHub Actions in this change.
- Do not fix individual React component findings here.
- Do not classify every warning rule as blocker or non-blocker in one pass.

## Decisions

1. **Owned surface first.**

   The gate should only scan repository-owned product, script, config, and test code. Embedded benchmark/sample repositories are evidence fixtures and must not decide platform release readiness.

2. **Two blocker channels.**

   Error diagnostics and Security category warnings should have separate commands. Error-only mode remains the main React correctness gate; the Security category command catches `no-danger`, `iframe-missing-sandbox`, and future security warnings.

3. **Warnings are triage input until curated.**

   Warning-level diagnostics span accessibility, maintainability, performance, and migration hints. They should be summarized by rule, category, and owned surface, then promoted into scoped changes only after review.

4. **No CI integration for now.**

   The project already records that React Doctor is local-only while CI quota is constrained. This change should improve local reproducibility without changing CI behavior.

## Risks / Trade-offs

- **Over-excluding files can hide real issues.** Mitigation: exclude only explicitly non-product roots and document the ownership rule.
- **Config drift can make old evidence incomparable.** Mitigation: pin version and record command/config path in reports.
- **Security warnings may include intentional constructs.** Mitigation: require either code remediation or explicit local allowlist with rationale and tests; do not silently ignore.
