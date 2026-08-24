## Context

`/profile/portfolio` is a client component that creates empty arrays and then calls three unrelated endpoints. The simulation insight endpoint and ethics endpoint are write-oriented, while prompt history is owned by a separate persistence change. The database already contains user-scoped `StudentStepResponse`, `SimulationLog`, and `EthicalLog` records that can support a read-only portfolio projection.

## Goals / Non-Goals

**Goals:**

- Provide one authenticated GET endpoint for the current student's portfolio evidence.
- Keep each evidence source user-scoped and return only display-safe summaries.
- Show classroom submissions, simulation parameter/score summaries, and ethics cases including remediation status.
- Return an explicit `available`, `empty`, or `unavailable` source state.
- Preserve the existing reflection draft flow and keep prompt history out of this change.

**Non-Goals:**

- No new Prisma models, migrations, LearningFact writes, portrait updates, official scores, or ranking writes.
- No prompt-assessment persistence or authorization changes.
- No display of raw trajectories, full response payloads, teacher synchronization state, or another user's records.

## Decisions

1. **Use a server-owned aggregation route.** `GET /api/profile/portfolio-evidence` authenticates the session and derives `userId` from the session. The browser never supplies a user ID and no existing write endpoint is reused as a read API.

2. **Use existing durable sources.** Classroom works come from the current user's `StudentStepResponse` rows, simulations from `SimulationLog`, and ethics cases from `EthicalLog`. Each query is bounded to the latest 20 source rows and the response exposes the source count plus the latest five display rows.

3. **Project summaries, not raw payloads.** A pure helper extracts a small title, type, timestamp, score/parameter summary, violation description, and student justification. Unknown or malformed JSON becomes a generic safe label rather than being serialized into the response.

4. **Fail per source.** The route uses independent source reads. A database error marks only that source `unavailable`; a successful query with zero rows is `empty`. This allows the UI to distinguish missing evidence from an unavailable source.

5. **Keep prompt history independent.** The portfolio keeps the existing prompt tab contract until the separate prompt-history change supplies an authenticated, durable response. This avoids duplicating its data ownership and security decisions.

## Risks / Trade-offs

- `[Risk]` Existing legacy rows may contain weakly structured JSON. `→ Mitigation:` use explicit field extraction and safe fallbacks; never return the original JSON.
- `[Risk]` A bounded read may omit older work from the initial view. `→ Mitigation:` return the source total and keep the UI label as recent evidence; pagination is outside this change.
- `[Risk]` Partial database failure can hide one evidence category. `→ Mitigation:` return `unavailable` per source and render a recoverable status instead of an empty-state claim.

## Migration Plan

No schema migration is required. Deploy the read route and client change together; rollback is a code rollback because existing source writes remain unchanged.

## Open Questions

None. Product direction is fixed by the existing personal-record boundary: the student can inspect their own evidence, while prompt history remains a separate change.
