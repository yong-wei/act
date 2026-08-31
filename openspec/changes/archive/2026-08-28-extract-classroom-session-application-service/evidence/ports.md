# Classroom session ports

Transaction and identity invariants for the application-service ports.

## Session persistence

- Create persists join code, plan, teacher, optional class, ACTIVE status, BRIDGE_IN stage, lesson snapshot, and CourseBundle revision in one write path.
- Class-bound create uses the existing `createClassBoundSession` transaction: duplicate detection, class ownership, and busy-class conflicts stay inside the adapter.
- Advance/end persist only validated stage/status fields; FINISHED writes `endTime` from the clock port.
- Join-code regeneration updates only `joinCode` on an ACTIVE session.

## Bundle resolver

- Generated-courseware sessions resolve publication identity before cache read or progress mutation.
- Runtime/plan projection bundle capture remains an adapter/helper; the use case only consumes the captured identity or a conflict.

## Clock

- Advance/end `updatedAt` and FINISHED `endTime` use the clock port rather than route-local `Date` construction.

## Event publication

- Start/join/patch/state writes keep the existing classroom observability event names and lifecycle evidence fields.
- Ending a session publishes the current finalization order: event ingestion, evidence-feature cache refresh, summary-report refresh, then best-effort summary generation.

## Stream signaling

- Access is decided by the stream use case.
- Backend selection is `redis` when Redis is ready, otherwise `poll`.
- Heartbeat is 15s; poll interval is 2s. SSE framing, subscriber cleanup, and disconnect abort remain in the delivery adapter.
