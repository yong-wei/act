## Why

`GET /api/interactive/events` currently treats a teacher or administrator role as sufficient authorization for arbitrary `userId`, `sessionId`, and `resourceKey` filters. It does not prove that the requested session belongs to a class taught by the requester or that the requested student is enrolled in that class. The same gap exists in the control-workbench and annotated-media diagnostic branches.

The ordinary response also returns complete `InteractionLog` rows, including direct user identifiers and `eventData`. Interactive AI questions are written into that payload for `ai_query_submit` events, so a normal teacher query can expose private student conversation content and implementation fields. This conflicts with the learning-record consumer contract: scope must be derived by the server, and raw events must be isolated to explicit historical operations.

## What Changes

- Derive teacher-readable class sessions and student scope from server-side class ownership and enrollment.
- Treat `userId`, `sessionId`, `resourceId`, and `resourceKey` as filters inside an already-authorized scope; reject an explicit out-of-scope target before reading event data.
- Replace normal teacher event responses with a role-minimized projection and safe aggregate statistics instead of serializing `InteractionLog` rows.
- Apply the same authorization scope and safe projection boundary to control-workbench and annotated-media diagnostics.
- Keep `ai_query_submit` question text, raw event payloads, direct identifiers, prompts, answers, and implementation fields out of ordinary teacher responses.
- Document and test that raw historical reads require a separate purpose-bound audit/debug/migration/drilldown operation with an actor scope, source revision, and receipt.

## Capabilities

### Modified Capabilities

- `learning-record-consumers`: interactive-event consumers use server-derived teacher scope, role-minimized projections, and an explicit raw-access boundary.

## Impact

- Changes the read path in `src/app/api/interactive/events/route.ts` and its control-workbench/annotated-media diagnostic branches.
- Adds or reuses a server-side teacher class-scope resolver and safe event projection helper.
- Extends route and projection tests for cross-class requests, roster membership, private AI questions, and diagnostic scope.
- Does not alter student event ingestion, durable raw-event retention, official scores, or learning-fact materialization.
- Does not expose a new raw-event endpoint; any future raw drilldown remains a separately authorized operation.
