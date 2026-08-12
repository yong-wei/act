## Context

The portfolio page builds a `portfolio-reflection` candidate from bounded navigation metadata, but its "mark this page as draft" action only changes React state. The existing AI task contract deliberately keeps the candidate separate from `LearningFact`, learner portraits, official scores, and formal portfolio publication. `LearningNote` lacks provenance, lifecycle, and idempotency identity, while `LearningEvidenceDraft` has a different governance role.

## Goals / Non-Goals

**Goals:**

- Persist only the displayed structured reflection candidate after an authenticated student explicitly saves it.
- Preserve source, optional assignment, intent, title, editable content, lifecycle, and request idempotency in a learner-owned record.
- Allow the owner to list, reopen, edit, and discard active drafts after refresh or a later login.
- Enforce user isolation on every read and mutation.
- Preserve the existing candidate-only boundary.

**Non-Goals:**

- Saving full Copilot transcripts, raw chat messages, provider metadata, or internal task context.
- Automatic formal portfolio publication, `LearningFact` creation, learner-portrait recalculation, score changes, or leaderboard writes.
- A future promotion workflow from draft to formal portfolio artifact.

## Decisions

1. **Use `PortfolioReflectionDraft` as a dedicated model.** It stores `userId`, bounded provenance fields, a title and editable candidate content, `DRAFT`/`DISCARDED` status, an idempotency key, and timestamps. A user-scoped unique key makes repeated create requests update one draft. This avoids overloading generic notes or evidence-governance candidates.

2. **Use authenticated REST routes under `/api/profile/portfolio-reflection-drafts`.** The collection route lists active drafts and upserts a new draft. An item route updates or discards a draft after filtering by both its id and the session user id. The API never accepts a user id from the client.

3. **Persist the displayed structured candidate, not the Copilot conversation.** The candidate title and detail become the initial draft payload and the page exposes only the draft content for student editing. This implements the selected scope without treating free-form AI chat as verified learning evidence.

4. **Keep discard as a lifecycle transition.** Discarded rows remain auditable but are excluded from the student's active draft list. The operation does not invoke any learning-state writer.

5. **Use bounded input validation at the persistence boundary.** Provenance uses the existing descriptor constraints; editable content permits normal paragraph formatting but rejects disallowed control characters and has a strict size limit. The draft is rendered as React text, never as HTML.

6. **Keep provenance and lifecycle immutable after creation.** The item edit API accepts only `content`; `source`, `assignment`, `intent`, `title`, and the idempotency identity remain the original saved candidate metadata. A repeated collection save returns the existing active draft unchanged, while a replay for a discarded identity returns a conflict and cannot reactivate it.

## Risks / Trade-offs

- [Risk] A browser retry could duplicate a draft. -> The client holds a UUID per candidate and the database enforces a user-scoped idempotency uniqueness constraint.
- [Risk] A draft could be mistaken for verified learning evidence. -> API names, stored status, UI status, OpenSpec requirements, and route tests explicitly prohibit `LearningFact` or portrait writes.
- [Risk] A student could access another student's draft by changing an id in the URL. -> All item reads and mutations scope the lookup to the authenticated user and return not found when no owned active row exists.
- [Risk] The candidate detail is generic before a future AI-output transfer flow exists. -> This change saves the currently displayed structured candidate exactly as selected; transferring AI response content remains a separate governed feature.

## Migration Plan

Deploy the additive table and enum before code that writes drafts. Existing users have no draft rows and continue to see the existing empty state. Rollback consists of reverting the application code; the additive table can remain without affecting formal learning records. No data backfill is required.

## Open Questions

None. The selected scope saves the displayed structured candidate only.
