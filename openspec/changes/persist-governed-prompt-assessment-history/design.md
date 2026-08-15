## Context

`/evaluation/prompt-assessment` provides prompt-quality feedback and a process-consistency check for automatic-control learning. The routes currently pass a request-supplied `userId` into a module-global `Map`; the history route reads any map key. The existing `PromptAssessment` table already owns the raw prompt, quality dimensions, suggestions, session reference, version, and creation time, but it is unused by this flow. `DesignSession` is a broader controller-design aggregate and does not provide a stable unique identity for one prompt-evaluation attempt.

This change must preserve the learning-process boundary: an evaluation is useful reflection evidence but is not a governed `LearningFact`, an official assessment result, or a learner-portrait input. Raw prompt and structured input are student-owned restricted payloads; the student-facing history projection is user-scoped.

## Goals / Non-Goals

**Goals:**

- Make authenticated session identity the only authority for evaluation writes and history reads.
- Persist each prompt-quality evaluation with a stable student/session/version identity.
- Attach a consistency result to one owned persisted evaluation attempt.
- Preserve prompt assessment history across process restart and multiple application instances.
- Keep the evaluation page and client-only demo behavior compatible.

**Non-Goals:**

- Creating `LearningFact` rows, updating learner portraits, recommendations, official scores, or leaderboards.
- Persisting full AI conversations, provider payloads, or any new unrestricted event stream.
- Redesigning the prompt-assessment experience or introducing a teacher/admin history view.
- Backfilling or reclassifying historical process-local map entries, which are not durable records.

## Decisions

1. **Use `PromptAssessment` as the single persisted attempt record.**
   Add nullable JSON columns for bounded audit task context and consistency result, plus a unique `(userId, sessionId, version)` constraint. This extends the model already designed for prompt-quality evidence and avoids splitting one attempt across an unrelated `DesignSession` aggregate.

   Alternatives considered:
   - A separate `PromptConsistencyAssessment` table: rejected because consistency has a one-to-one lifecycle with a prompt attempt and does not need an independent activity feed.
   - Reusing `DesignSession`: rejected because it has no unique evaluation-session identity and may describe controller work unrelated to the submitted prompt.

2. **Authenticate at each route boundary and ignore client identity.**
   The two POST routes require `getServerAuthSession().user.id` before parsing a learning record into persistence. The history route requires the same session and rejects a different route `userId` before querying. The client continues to send compatibility fields during migration, but they never choose the database scope.

   Alternatives considered:
   - Allow anonymous records under a demo identity: rejected because that creates shared, non-attributable production data. The page already has a client-only demo path.
   - Use the path `userId` as authorization: rejected because route parameters are selectors, not identity proof.

3. **Allocate versions transactionally with bounded conflict retry.**
   Within a serializable transaction, read the latest version for the authenticated student and supplied evaluation session, then create the next record. Retry only database serialization or unique-key conflicts a bounded number of times. The database uniqueness constraint remains the final correctness boundary.

   Alternatives considered:
   - Count records to derive version: rejected because deletion or migration would renumber a history.
   - Leave version allocation in the browser: rejected because multiple tabs and retries can collide or forge ordering.

4. **Require an owned persisted attempt before recording consistency.**
   The consistency route finds the authenticated student's record by session and version, calculates the result, and updates that record. A missing or foreign target returns a not-found response without writing a substitute record.

5. **Expose a user-scoped history projection, not a cross-user store.**
   The history handler reads only by `session.user.id`, orders records by creation time and version, and maps database rows to the existing page contract. Raw prompt content remains confined to its owner-facing flow; no teacher, admin, portrait, or public projection is added by this change.

## Risks / Trade-offs

- [Risk] An additive unique constraint can fail if existing rows have duplicate user/session/version triples. → The migration checks and deterministically retains existing records only when the live database is clean; deployment validation runs before applying the constraint.
- [Risk] Concurrent browser submissions can contend for the next version. → Serializable transaction plus bounded retry and the unique constraint ensure exactly one version per successful record.
- [Risk] Route-level authentication changes can expose client assumptions about anonymous mode. → Retain the page's client-only demo branch and cover unauthenticated failures explicitly.
- [Risk] A stored evaluation could be mistaken for profile-grade evidence. → No `LearningFact` writer or portrait consumer is invoked; the spec declares the record context-only until a later governed change.

## Migration Plan

1. Apply an additive migration for the two JSON fields and the user/session/version unique index after checking the target database for duplicate triples.
2. Deploy route and persistence code after the schema is available.
3. Verify authenticated create, owned history read, consistency attachment, restart-safe read, and the absence of `LearningFact` writes.
4. Roll back application code if needed; added columns and unique index remain inert. Do not reconstruct process-local historical records.

## Open Questions

None. The change intentionally keeps evaluation records context-only and does not invent a profile-contribution policy.
