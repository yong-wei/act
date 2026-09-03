## Context

The direct resource route at `/interactive-learning/resources/[id]` loads a database resource and invokes the shared `ResourceRenderer` without a classroom session. The renderer already creates a `ResourceRendererLaunchContext` whose `provenance` is `standalone` when no course context exists, but it currently passes `embedded={true}` to every `InteractiveProvider` and does not pass the launch context to the provider. The provider therefore derives `isStandaloneResource` from a presentation flag and disables the standalone persistence path.

The server ingestion boundary already accepts authenticated events with `learningContext: 'standalone_resource'`, stores them in `InteractionLog`, and routes governed event records to the learning-record pipeline. The change should connect the existing contracts rather than introduce a second ingestion path or a new evidence table. The same shared renderer also creates a knowledge-card tracker; that tracker must receive the renderer's `sessionId` so classroom knowledge-card events retain classroom provenance instead of being treated as standalone activity.

## Goals / Non-Goals

**Goals:**

- Make the direct resource launch context explicit at the shared runtime boundary.
- Keep classroom, classroom-review, pre-class, post-class, demo, and anonymous behavior distinct.
- Allow authenticated direct-resource view, interaction, and completion events to reach the existing server ingestion path.
- Preserve canonical standalone event classification and resource provenance in persisted records.
- Make the boundary and behavior regression-testable without granting views or completions mastery status.

**Non-Goals:**

- Changing the `/api/interactive/events` storage schema or creating a parallel standalone event API.
- Treating standalone participation as a score, mastery claim, official grade, or automatic competency contribution beyond existing policy.
- Persisting anonymous or demo activity as a learner-owned server record.
- Changing classroom resource rendering, classroom session authorization, or existing generated-courseware persistence.

## Decisions

1. **Use the existing explicit launch context as the source of provenance.** The direct resource route and `ResourceRenderer` already have enough identity fields to describe a standalone resource. The provider will receive a discriminated runtime context derived from that descriptor. This avoids inferring learning context from `embedded`, which describes layout and is shared by unrelated entrypoints.

2. **Keep presentation and learning context separate.** `embedded` remains a layout/header input. Standalone detection and persistence eligibility will use explicit launch provenance plus the absence of a classroom session. Classroom callers continue to pass their session context and retain classroom event semantics.

3. **Carry classroom session identity into every tracker created by the shared renderer.** The renderer's resource tracker and knowledge-card tracker use the same tracking hook, so both must receive the caller's `sessionId`. The absence of a session is meaningful only for a genuinely independent launch; it must not be introduced by an omitted hook argument.

4. **Reuse the current tracking hook and ingestion endpoint.** The provider will enable `persistWithoutSession` only for an authenticated standalone launch and will include the explicit standalone context in event data. The existing hook will continue to queue events locally until sync and remove them only after a successful API response.

5. **Keep server ownership of learner identity and evidence eligibility.** The client may identify the resource and launch surface, but the server continues to derive the authenticated user from the session and applies the existing event allowlist, canonical event resolution, and profile-contribution policy.

6. **Test both sides of the boundary.** Contract tests will prove that direct resources pass standalone context and that classroom resources still pass classroom context, including knowledge-card tracking. Tracking and route tests will prove authenticated standalone persistence/classification, demo and anonymous non-persistence, and that low-value view events do not become mastery evidence.

## Risks / Trade-offs

- **[Risk]** A caller could pass an inconsistent context object. **Mitigation:** construct the context in the resource renderer from source-owned fields, validate its discriminant at the provider boundary, and let the server normalize the final learning context.
- **[Risk]** Retrying a completion could duplicate durable evidence. **Mitigation:** retain the existing client event identity and server `skipDuplicates` behavior; add a regression for repeated sync.
- **[Risk]** Existing classroom components may depend on `embedded=true`. **Mitigation:** preserve the prop for classroom calls and change only the direct resource launch path's explicit provider context.

## Migration Plan

No database migration is required. Deploy the runtime/context propagation and tests together. Existing browser-local standalone events cannot be safely backfilled because their provenance and authenticated ownership are not server-verifiable; they remain local and expire under existing storage behavior. Rollback is an application-code revert and leaves the existing ingestion schema unchanged.

## Open Questions

None. The repository already defines the standalone learning context and its ingestion path; this change closes the missing runtime propagation.
