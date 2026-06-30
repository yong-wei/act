## Tasks

- [ ] 1. Define the persisted SAR index schema and retention boundaries.
  - Include event, entity, event-entity relation, and query trace records.
  - Exclude restricted raw content and audit-only payloads by contract.

- [ ] 2. Implement idempotent SAR persistence and safe trace serialization.
  - Upsert stable projection records without duplicates.
  - Persist query traces with safe summaries, limitations, version refs, and citation/source-pack handoff status.

- [ ] 3. Define and enforce query trace retention/minimization.
  - Use hash-only query storage, explicit student-scoped trace retention windows, aggregation or deletion boundaries, and export exclusion for expired or restricted traces.

- [ ] 4. Add privacy and durability tests.
  - Cover raw learner answer, hidden Arena internals, private Konling memory, audit-only trace rejection, duplicate projection, and stable query trace reads.
  - Cover trace retention, minimization, deletion or aggregation, and export exclusion behavior.

- [ ] 5. Validate the change.
  - Run `rtk openspec validate persist-sar-retrieval-index-and-query-traces --strict`.
  - Run targeted SAR persistence and data-governance tests.
