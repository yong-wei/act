## Context

Path node launch currently appends path identifiers to target URLs, but target resources do not consume a stable `source` or `returnTo` contract. Resource pages therefore fall back to `互动学习`, while course runtime shells fall back to their course entry. Students completing a precheck from a selected path are sent outside the path container.

## Goals / Non-Goals

**Goals:**

- Normalize path launch context at the adaptive path center boundary.
- Make target resource and course shells consume path return context when present and authorized.
- Preserve ordinary return behavior for non-path launches.
- Cover both resource routes and course runtime routes used by path nodes.

**Non-Goals:**

- Writing completion events after a resource is completed.
- Changing path option selection layout.
- Changing latest path recovery or completion summary behavior.

## Decisions

- Build a single path launch context mapper instead of per-resource URL string assembly. The mapper should derive `source=adaptive-path-center`, `goalId`, `pathId`, `nodeId`, `intent=path-execution`, `resourceType`, and `returnHref`.
- Target pages should consume the normalized context through a shared helper or shell prop. The user-facing return label should be path-specific only when the context validates.
- Authorization remains server-owned. Client-provided path ids are navigation hints; any write or privileged read must still pass existing path access checks.

## Risks / Trade-offs

- **Risk:** Some target routes may not yet support contextual return props.  
  **Mitigation:** update the common resource page and shared course runtime shell first, then add route-level adapters only where needed.
- **Risk:** Query strings could become long or inconsistent.  
  **Mitigation:** keep a canonical context schema and test the generated return href for representative resource types.
