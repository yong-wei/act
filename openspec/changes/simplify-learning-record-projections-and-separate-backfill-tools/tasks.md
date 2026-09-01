## 1. Freeze online and backfill baselines

- [ ] 1.1 Import the C8 final ingestion boundary and capture projection/consumer/backfill state at the same clean revision.
- [ ] 1.2 Enumerate current-pointer writers, projection builders, caches, page/API raw aggregators, fallback readers and historical tools with caller/owner evidence.
- [ ] 1.3 Add characterization coverage for qualified, known-zero, missing, partial, stale, unavailable, privacy, small-sample and watermark/pointer-fence states.

## 2. Simplify online projections and consumers

- [ ] 2.1 Route student, teacher, AI and Personalization normal reads through the existing role-safe current projection ports.
- [ ] 2.2 Remove duplicate page-level raw aggregation and legacy fallback only after output/status/provenance parity is proven.
- [ ] 2.3 Classify feature caches as declared downstream projections or duplicate authorities; delete only the latter with zero-caller evidence.
- [ ] 2.4 Run code-simplification before/after checks after each focused change and preserve all error, privacy and rollback behavior.

## 3. Separate historical tools

- [ ] 3.1 Give backfill/materialization/report regeneration commands explicit dry-run/apply, frozen cutoff/input digest, operation identity, scope and receipt contracts.
- [ ] 3.2 Add guards proving ordinary backfill cannot publish online current pointers, alter live watermarks, emit unbound triggers or overwrite source anchors.
- [ ] 3.3 Keep dedicated cumulative/cutover migrations on their existing fenced contract and add tests for the allowed distinction.

## 4. Remove obsolete paths and verify

- [ ] 4.1 Delete or isolate only legacy readers, aggregators, caches and tools with zero required callers, replacement parity, privacy proof and rollback conditions.
- [ ] 4.2 Run online route/read-port, projection, teacher small-sample, backfill, PostgreSQL and deletion-receipt tests including restart/retry cases.
- [ ] 4.3 Run `rtk npm run typecheck`, `rtk openspec validate simplify-learning-record-projections-and-separate-backfill-tools --type change --strict`, `rtk openspec validate --specs --strict` and `rtk git diff --check`.
- [ ] 4.4 Record the final online/backfill boundary and retained legacy exceptions; do not execute production backfill or selector mutation as part of this change.
