## Context

See `proposal.md` for motivation. The existing assessment flow gives the browser a durable answer ID after submission. The server can turn that answer into a governed attribution, orchestration result and micro-intervention, but the current browser has neither an attribution identity nor a learner-safe validation-question read path.

## Goals / Non-Goals

**Goals:**

- Connect the existing governed services to the wrong-answer feedback in `/assessment/adaptive-practice`.
- Keep all attribution, authority, answer evaluation and recommendation decisions on the server.
- Make browser retries idempotent and make unavailable/drift states explicit.

**Non-Goals:**

- Altering persistence schema, mastery updates or formal path state.
- Creating a separate student workspace, teacher workflow or generated validation question.

## Decisions

### Use the durable answer as the browser boundary

The remediation creation endpoint will accept an `answerId`, not an attribution ID. It will derive the attribution with the authenticated learner and call the existing orchestrator. This makes the adaptive-practice feedback sufficient to enter the flow while retaining current ownership checks.

Alternative considered: expose attribution IDs after answer submission. Rejected because attribution is an internal evidence identity and would require the browser to coordinate two server services.

### Keep the workflow in a focused client component

A dedicated `StudentMicroTutoringPanel` will receive the durable answer ID and render a small state machine: idle, creating, unavailable, available, starting, active, validating, completed and request-error. The existing adaptive-practice page remains responsible for answer feedback and passes only the answer ID into the panel.

Alternative considered: add the flow directly to the large adaptive-practice page. Rejected because lifecycle and retry state would make that page harder to reason about and test.

### Read validation content only for a started intervention

A new authenticated read endpoint will retrieve a current intervention and return a minimal question projection. It will verify intervention ownership and availability before using the existing runtime question source. The result includes question ID, prompt and option labels/text only. The existing validation write endpoint remains the sole evaluator.

Alternative considered: include the question in the orchestration or start response. Rejected because it would expose it before intervention start and weaken the existing read-time authority check.

### Treat resource launches and events as separate but ordered actions

The panel records `RESOURCE_USED` successfully before opening an in-app resource target. Hint and completion controls similarly wait for their event response. The flow retains the intervention ID locally but never persists it in the URL. Resource target paths must be platform-relative; unsafe targets fail visibly without a launch.

Alternative considered: emit events after navigation. Rejected because navigation can unload the page before the evidence write completes.

### Use server projections as the only display model

The panel displays titles, action paths, duration, progress, validation result and recommendation from learner-safe responses. It does not reconstruct metadata from IDs or infer recommendations from validation outcomes.

### Restrict entry and selection to current governed evidence

The adaptive-practice page renders the entry only when the persisted wrong answer carries a reviewed catalog reference. Standalone practice prioritizes reviewed catalog items approved for `low-stakes-practice`, so the user-visible entry does not appear for legacy questions that cannot yield a governed attribution. During orchestration, a unique KAQ knowledge-node reference or the reviewed learning-goal mapping may establish the canonical node; an active canonical graph node remains valid before a duplicate database `KnowledgeNode` projection exists. A reviewed remediation item on that same node is a valid verification candidate. These choices alter selection only to enforce the existing governed micro-tutoring boundary; they do not alter formal learning-path selection or mastery.

## Risks / Trade-offs

- [Existing governed tasks have no matching resources or validation items] → show the existing sanitized unavailable projection; do not manufacture a UI fallback task.
- [Resource navigation leaves the practice page] → open eligible resource actions in a separate browser context after the event is recorded, preserving the intervention panel on return.
- [Retries race with a prior request] → reuse the same generated event key until the corresponding request receives a definitive result.
- [Question content drifts after start] → server returns unavailable and the UI clears the question rather than retaining stale options.
- [Task reference drifts before or during start] → the UI hides stale task details and offers an explicit fresh orchestration attempt. The server derives ownership from the durable answer, accepts a stable refresh key, and creates or returns a distinct refreshed orchestration only after the initial owned result projects as `REFERENCE_DRIFT`; it never automatically retries the stale request.
- [A user reloads during active tutoring] → the panel can read the known intervention by its locally retained ID during the current page lifecycle; durable cross-reload restoration is outside this first UI connection.

## Migration Plan

1. Deploy the additive answer-bound orchestration and validation-question read endpoints.
2. Deploy the panel and adaptive-practice integration; no data backfill is required.
3. Roll back by removing the panel entry first. Existing orchestration and micro-intervention records remain valid and inert without a client caller.
