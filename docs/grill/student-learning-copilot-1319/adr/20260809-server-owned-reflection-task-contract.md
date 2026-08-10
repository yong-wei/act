# Use a server-owned contract for portfolio reflection context

The portfolio-reflection Copilot request SHALL carry only a bounded, student-safe task descriptor from the client and SHALL be revalidated into a server-owned task contract before model execution. This preserves the learning task, intent, output target, and explicit-save boundary without trusting client-supplied permissions or exposing internal runtime context; ordinary Copilot requests continue to use the existing general page context.

## Considered Options

- Trust the existing client `reflectionDraft` and `taskContract`: rejected because the API currently does not parse or validate them, and a client could alter task type or writeback semantics.
- Reconstruct the task only from the URL: rejected because URL parameters are navigation hints, not an authenticated task authorization source.
- Add a small discriminated request descriptor and resolve it server-side: selected because it preserves the intended learning semantics while keeping internal context and writeback governance server-owned.

## Consequences

The client must send a stable task descriptor for portfolio reflection. The server must reject malformed or unsupported descriptors, inject only verified evidence and bounded task semantics into the model prompt, and keep the resulting content a candidate until an explicit portfolio save flow persists it.

## Follow-up: keep descriptor values as data

The server-owned boundary also rejects Unicode `Cc` controls, including C0 and C1 characters, in client-supplied `source`, `assignment`, and `intent` before trimming. It also rejects Unicode line and paragraph separators. Accepted values are serialized as delimited JSON data in the private task section; they are never interpolated into instruction-shaped prompt lines. This prevents URL-derived multiline content from becoming a competing system instruction while preserving the existing candidate-only and explicit-save boundary.
