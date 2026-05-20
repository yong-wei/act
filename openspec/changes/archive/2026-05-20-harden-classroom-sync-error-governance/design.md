## Context

Fetch diagnostics already capture source, URL, method, elapsed time, visibility state, online state, and connection hints. The missing layer is incident aggregation and recovery semantics. Reports need to preserve raw logs but judge classroom health from incident-level evidence.

## Goals / Non-Goals

**Goals:**

- Reduce noisy repeated sync error emission.
- Keep real HTTP failures and sustained timeouts visible.
- Add report-level classification useful for post-class analysis.
- Preserve raw diagnostic detail for debugging.

**Non-Goals:**

- Replace polling with a different transport.
- Hide server-side or sustained client failures.
- Change lesson submission evidence.

## Decisions

### Decision: Aggregate on the client before emission

The client has the best context for repeated failures, visibility state, and recovery. It should suppress or aggregate repeated non-critical failures and emit incident summaries with enough detail for reports.

### Decision: Keep raw diagnostics available

Incident aggregation should not delete or prevent detailed debugging where needed. Reports should separate raw error rows from incident count and affected-user count.

### Decision: Add recovery events

A later successful poll after failures should emit or derive `sync_recovered` information. This prevents transient network noise from looking like an unresolved classroom failure.

## Risks / Trade-offs

- [Risk] Over-aggregation hides real failures. Mitigation: HTTP errors and sustained timeouts remain high-severity and visible.
- [Risk] Incident windows may be tuned poorly. Mitigation: keep constants named and covered by tests.
- [Risk] Reports become harder to read. Mitigation: expose a small set of severity and source fields.

## Migration Plan

1. Add incident aggregation and recovery semantics to shared session fetch handling.
2. Update sync error event payloads with incident metadata.
3. Update session reports to consume incident-level fields.
4. Add tests for abort suppression, timeout escalation, HTTP failures, and recovery.
