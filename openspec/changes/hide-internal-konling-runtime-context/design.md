## Context

The context endpoint serializes the same internal structures used for model grounding and diagnostics. Repository search finds no production browser consumer, but the authenticated route exposes learner-state context, plans, workspace context, teaching projections, provenance, scoped memory, tool permissions and missing-context diagnostics. Existing Konling requirements keep raw diagnostics, private memory and internal identifiers server-side.

## Goals / Non-Goals

**Goals:**

- Remove browser access to the complete runtime context.
- Preserve only an explicitly reviewed student-safe projection if a real product consumer exists.
- Keep model grounding and service-side observability intact.
- Prove the raw authenticated response excludes internal canary values.

**Non-Goals:**

- Removing private context from model execution.
- Redesigning learner-state, plans, knowledge workspace or teaching projection internals.
- Building a general administrator diagnostics console.

## Decisions

### 1. Default to retiring the public runtime DTO

Because no production frontend consumer is present, the preferred implementation removes or makes the complete endpoint unavailable to student sessions. If a verified production dependency is found, it receives a separate allowlisted DTO rather than a filtered copy of the internal object.

### 2. Keep internal fields on the service side

Private memory, permitted tools, missing-context codes, provenance and raw domain contexts remain available to server-owned prompt construction, logs and tests. They are not serialized and then hidden by client code.

### 3. Verify the raw response boundary

Route tests use unique canary values across every internal context family and inspect serialized responses. Model/runtime tests independently prove that removing the public DTO does not remove server-side grounding.

## Risks / Trade-offs

- [Risk] An undocumented caller relies on the endpoint. -> Search production imports and access logs where available; if needed, create a narrow versioned public projection with explicit fields.
- [Risk] Tests lose an easy introspection path. -> Test internal builders directly or through service-owned diagnostics rather than exposing production data.
- [Risk] A shallow omission leaves nested identifiers. -> Serialize the complete response in regression tests and search for canary values.

## Migration Plan

Inventory consumers, retire the public DTO or introduce a narrow replacement, update tests, and verify model grounding separately. No database migration is required.

## Open Questions

None. A concrete production consumer may choose between removal and a bounded projection, but cannot retain the complete internal DTO.

