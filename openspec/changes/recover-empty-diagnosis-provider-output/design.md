# Design: Bounded diagnosis empty-output recovery

## Context

Teacher diagnosis generation already freezes governed input before invoking the
provider and validates every result before atomic report persistence. Some
structured provider calls return no completed output. Reissuing the same
structured request is not a useful recovery because it can repeat the provider
transport failure.

## Decision

Only the teacher-diagnosis provider adapter enables a single fallback. When
the structured call raises the runtime's empty-output error, the runtime sends
the same governed prompt again as a plain text request requiring exactly one
JSON object. It gives the fallback a distinct deterministic idempotency key so
an upstream provider does not reuse the failed structured request.

The fallback accepts either raw JSON or a JSON code fence, then sends the
parsed object through the existing diagnosis output schema and evidence
provenance validation. Before the broader persistence schema, a fallback is
also checked against the bounded provider diagnosis schema declared in its
request. A malformed fallback remains a provider failure; no partial report is
written. If the fallback is empty, unparsable, or invalid against either
diagnosis schema, the worker stores
`diagnosis-provider-empty-output` as a retryable failure.

## Boundaries

- The fallback is opt-in and defaults off for every other provider runtime
  consumer.
- It does not reread evidence, alter the cutoff, or bypass result validation.
- It preserves the existing job, attempt, queue, and report transaction model.

## Verification

- Mock an empty structured call followed by valid JSON text and assert fallback
  request isolation and returned response metadata.
- Assert unparsable and schema-invalid fallback output receives the dedicated
  retryable error code.
- Assert a fallback that only violates the bounded provider schema cannot pass
  through the broader persistence schema.
- Run the focused diagnosis and provider-runtime tests; run typecheck when the
  local runtime has sufficient heap.
