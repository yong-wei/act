## Context

Konling now has stable domain APIs and strong behavior tests, but its central runtime still mixes coordination with repeated tool metadata, context, citation, and run-state plumbing.

## Goals / Non-Goals

**Goals:**

- Keep one readable application coordinator.
- Use existing domain public APIs instead of duplicating domain decisions.
- Remove obsolete compatibility and repeated orchestration logic.

**Non-Goals:**

- No new AI framework, generic dispatcher, provider change, public API, schema, or UI redesign.
- No weakening of permissions, approval, privacy, citations, idempotency, or safe failures.

## Decisions

1. Start from the current tool and session characterization tests; do not redesign behavior while simplifying it.
2. Separate only established boundaries: tool metadata, context projection, citation policy, domain adapters, and run state.
3. Domain adapters call existing public APIs and do not own domain state or policy.
4. Delete compatibility branches only after their consumers are absent and the canonical route is covered.

## Risks / Trade-offs

- **Similar tool flows may have different permissions or side effects.** Keep them separate unless those contracts are identical.
- **Extraction may create another framework.** Use plain modules and direct functions; no registry beyond the existing tool registry.
