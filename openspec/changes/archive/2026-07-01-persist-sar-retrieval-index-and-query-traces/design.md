## Design

This change moves SAR from first-stage in-memory/service projection toward a durable index. The persistence layer should mirror the existing TypeScript SAR contract rather than inventing a second schema.

## Data Boundary

Persisted records should include stable ids, event/entity type, title or label, safe summary, source owner/ref/type, authority level, privacy scope, freshness, content hash, relation role/confidence/source, trace seed/selected/rejected refs, limitations, version refs, and downstream Source Pack or citation handoff state where available.

Persisted records must not include raw learner answers, raw private memory, hidden Arena evaluation internals, full audit-only traces, or unredacted private evidence.

## Rebuild Semantics

The implementation should support idempotent projection upserts keyed by stable SAR ids and content hash. Rebuilds may update safe summaries and relation sets.

## Trace Retention And Minimization

Query traces are governed learning-evidence metadata even when they contain no raw answer bodies. Persistence must define retention and minimization rules before storing student-scoped or class-scoped trace history. At minimum, stored traces should use a query hash instead of raw query text, keep student-scoped trace refs within an explicit retention window, support aggregation or deletion after that window, and exclude expired or restricted traces from exports.

## Verification Strategy

- OpenSpec strict validation.
- Prisma/migration tests if schema changes are introduced.
- Unit tests for idempotent upsert, duplicate relation prevention, privacy redaction, trace serialization, retention/minimization, and safe export.
- Data-governance tests asserting forbidden fixture strings do not appear in persisted/exported SAR payloads.
