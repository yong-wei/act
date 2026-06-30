## Why

`docs/proposals/2026-06-26-sag.md` explicitly keeps first-stage SAR out of Prisma while the contract stabilizes. That first stage is now represented by SAR contracts, projection, association expansion, Konling grounding, Graph Center candidate evidence, path-planner candidate handling, diagnostics builders, and the active administrator diagnostics surface. The remaining production gap is durability: SAR events, entities, relations, and query traces cannot yet be inspected across process restarts, compared over time, or joined with later governance workflows.

## What Changes

- Add a governed persistence contract for `SarRetrievalEvent`, `SarRetrievalEntity`, `SarRetrievalEventEntity`, and `SarRetrievalTrace`.
- Persist only safe summaries, stable refs, content hashes, version refs, privacy scope, authority, and trace metadata.
- Keep raw learner answers, hidden Arena internals, private Konling memory, and audit-only raw payloads out of SAR persistence.
- Provide idempotent upsert/rebuild behavior so projection refresh can update SAR records without duplicate entities or stale traces.
- Add tests proving privacy redaction, unique refs, trace serialization, and query trace retention.

## Impact

- Extends `structured-associative-retrieval`.
- May add Prisma schema and migration in implementation.
- Does not change Source Pack ranking, final citation verification, path-planning authority, or automatic K/A/Q graph bindings.
