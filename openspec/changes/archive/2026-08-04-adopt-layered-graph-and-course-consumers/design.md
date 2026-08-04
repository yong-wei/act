## Context

Engineering Authority and Teaching Projection have different owners and release identities. The UI must make that distinction visible in data contracts without forcing students to understand implementation details. Course scope is the authoritative boundary for teaching resources.

## Series Dependencies

- Depends on: `activate-versioned-actkg-engineering-authority`, `introduce-versioned-act-teaching-projection`, `project-active-course-resources-to-canonical`.

## Goals / Non-Goals

**Goals:**

- Keep exact engineering predicates and Canonical identities in graph payloads.
- Add opt-in teaching prerequisite/resource layers with explicit scope and projection IDs.
- Make step-driven card lookup optional and fail-safe.
- Preserve current Legacy readers until per-consumer activation.

**Non-Goals:**

- Do not redesign graph visual language, add new path algorithms, or rewrite cards here.
- Do not infer teaching edges from engineering relations or use entire Authority as a course projection.

## Decisions

### 1. Layered payload

Payload includes `engineering` (Authority release and exact ActKG nodes/relations), `teachingPrerequisites` (ACT scope/projection and REQUIRED/RECOMMENDED edges), and `teachingResources` (bindings grouped by resource/role). Every layer carries its own identity and may be absent without invalidating another layer.

### 2. Scope-aware course reads

Course entry and classroom drawer pass current course/lesson/step scope to the Teaching Projection resolver. Resolver returns only resources/bindings reachable from that scope and current projection combination; it never scans all Authority nodes to fill gaps.

### 3. Drawer resolution

`step.knowledgeRefs -> canonicalId -> optional card` is the only card path. If no active card exists, show the Canonical summary and linked handout/interactive/textbook resources. A card absence is a resource status, not a node-not-found error.

### 4. Fallback

If the requested projection or Authority is unavailable, consumers use an explicitly named Legacy/pinned fallback adapter with status/provenance. They do not silently mix versions or create cross-layer edges.

## Risks / Trade-offs

- Layered payloads add fields and UI filter state; explicitness prevents authority leakage and makes debugging possible.
- Some old consumers may ignore new layers; compatibility adapters keep them functional until activation.

## Migration Plan

Add payload schemas and resolver tests, then wire graph and course drawer in shadow/read-only mode. Keep existing route behavior and fallback; activation is handled by a later change.

## Open Questions

None. Layer ownership and scope are fixed.
