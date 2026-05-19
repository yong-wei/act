## 1. Source Adapter Contract

- [x] 1.1 Define a materialization adapter contract that consumes catalog eligibility and emits evidence candidates.
- [x] 1.2 Implement adapters for eligible high-value simulation, assessment, prompt/design, Arena, resource-completion, and interactive event families.
- [x] 1.3 Preserve source references, source windows, canonical event types, evidence subtype, user id, and confidence metadata in each candidate.
- [x] 1.4 Keep seed, showcase, demo, test, unknown-provenance, unsupported, and context-only rows out of profile-grade materialization by default.

## 2. Dry-Run And Apply Materialization

- [x] 2.1 Add a dry-run command that reports candidate, excluded, unsupported, and low-confidence counts without writing records.
- [x] 2.2 Add an explicit apply mode that writes only derived governance facts for eligible candidates.
- [x] 2.3 Make source identity stable so repeated apply runs do not create duplicate facts.
- [x] 2.4 Preserve raw source tables; do not mutate historical source rows.

## 3. Audit And Verification

- [x] 3.1 Report materialized counts, skipped counts, affected users, source windows, and sample trace references after apply.
- [x] 3.2 Add focused tests for adapter eligibility, canonical event handling, exclusion policy, dry-run/apply parity, and idempotency.
- [x] 3.3 Run targeted data-governance tests, `npm run lint`, `npm run test`, and `openspec validate materialize-historical-out-of-class-learning-facts --strict`.
- [x] 3.4 Phase acceptance: eligible historical records can be materialized once, traced back to raw sources, and safely re-run without duplicate profile facts.
