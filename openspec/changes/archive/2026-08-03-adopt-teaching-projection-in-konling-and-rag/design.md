## Context

The layered graph and migrated resources provide deterministic identities. Konling must consume them as signed/server-resolved context, not rely on a client-selected node or model-generated relationship. Engineering answers and teaching explanations have different source and privacy boundaries.

## Series Dependencies

- Depends on: `activate-versioned-actkg-engineering-authority`, `introduce-versioned-act-teaching-projection`, `project-active-course-resources-to-canonical`, `project-actkg-textbook-locators`, `migrate-knowledge-cards-to-canonical`.

## Goals / Non-Goals

**Goals:**

- Carry one explicit Authority/Projection combination and current scope through Konling requests.
- Provide canonical/resource/prerequisite/card context with bounded neighborhood and citation metadata.
- Keep RAG domains separately governed and compose only at query time.

**Non-Goals:**

- Do not rebuild Konling session architecture, add a new graph store, or change model provider.
- Do not make teaching edges ActKG facts or let model output create bindings/prerequisites.
- Do not expose raw textbook text or hidden learner evidence.

## Decisions

### 1. Server-owned context fields

The resolved context includes `authorityReleaseId`, `projectionId`, current `canonicalIds`, `linkedResources`, `prerequisiteAncestors`, `prerequisiteSuccessors`, optional active card metadata, scope, and evidence cutoff. The server re-reads/validates IDs and user/course permissions; client hints are advisory only.

### 2. RAG domains

Engineering RAG reads ActKG nodes, exact engineering relations, and public provenance under Authority only. Teaching Resource RAG reads projected course/handout/step/textbook/card resources under Teaching Projection only. A composed answer records both domain identities and citations; neither domain silently inherits the other's edges.

### 3. Card and prerequisite behavior

Card metadata is optional; absent cards cause fallback to Canonical summary/linked resources. Prerequisite context is bounded to the current scope and required/recommended neighborhood. No card or teaching edge is synthesized from labels or model output.

### 4. Fallback and privacy

When a requested version is unavailable, the resolver returns a typed Legacy/pinned fallback with identity and reason. Unauthorized resources, raw answers, and learner IDs are excluded before model context assembly.

## Risks / Trade-offs

- Dual-domain retrieval increases response metadata but makes provenance and debugging explicit.
- Bounded prerequisite neighborhoods may omit distant context; callers can request a new scoped query instead of expanding one prompt indefinitely.

## Migration Plan

Extend server contracts and unit tests first, then run Engineering and Teaching Resource RAG in shadow composition for representative graph/course/textbook/card queries. Keep existing fallback until activation is approved.

## Open Questions

None. Field and domain boundaries are fixed.
