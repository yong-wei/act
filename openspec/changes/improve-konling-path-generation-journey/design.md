## Context

Path generation crosses a React interaction surface, a server route, the Konling AgentToolRun idempotency boundary, and the shared sidebar. React state commits asynchronously, and an HTTP 500 or disconnected response does not prove whether the governed tool side effect was committed, so request identity cannot be derived from render state or response class alone.

## Goals / Non-Goals

**Goals:**

- Start one governed generation when the student activates the primary action.
- Freeze a stable request identity synchronously before React rerenders.
- Reuse that identity while execution is active or its result is unknown.
- Make terminal status visible without replacing the page that emitted it.
- Produce focused automated and responsive browser evidence for PR A.

**Non-Goals:**

- Redesign path comparison, execution, history, or evidence workflows assigned to later #1140 PRs.
- Change the AgentToolRun persistence model or planner behavior.
- Treat a transport status as proof that a server-side tool run failed.

## Decisions

1. A request lifecycle ref is the synchronous authority for click admission and request identity. React state remains the rendering projection. This prevents two handlers from passing an `idle` state before the first state commit.
2. The API reports `failed` only when the governed runtime returns a definitive business or tool failure. Unexpected route exceptions return an unknown/running lifecycle projection with the same request ID because the route cannot prove that no side effect occurred.
3. Unknown-result retries and running-status checks reuse the frozen ID. A new UUID is created only when the previous lifecycle is definitively terminal and the student explicitly activates regeneration.
4. Generation status is published as local page events and projected into the Konling sidebar without sending a chat message to the model. Stable message IDs prevent duplicate status rows.
5. Successful generation refreshes the current path in place. Avoiding immediate full-page navigation preserves the sidebar status and refreshed comparison state.

## Risks / Trade-offs

- [A route exception can leave an actually failed request displayed as running] -> A retry uses the same ID and lets the authoritative runtime return its persisted state without duplicating side effects.
- [Refs and React state can diverge] -> Centralize lifecycle transitions in small helpers and cover synchronous duplicate activation and terminal transitions with behavior tests.
- [Browser evidence depends on local seed/auth state] -> Record the exact commit, viewport, capture time, request observations, and any fail-closed limitation rather than fabricating a passing state.
