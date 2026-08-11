## Series Dependencies

- Depends on: `activate-versioned-actkg-engineering-authority`, `introduce-versioned-act-teaching-projection`, `project-active-course-resources-to-canonical`, `project-actkg-textbook-locators`, `migrate-knowledge-cards-to-canonical`.

## 1. Context contract

- [x] 1.1 Extend server-owned Konling context schemas with Authority/Projection/current Canonical/resource/prerequisite/card fields and scope.
- [x] 1.2 Revalidate client hints, signed context, authorization, fallback identity, and evidence cutoff at the server boundary.
- [x] 1.3 Add tests for optional card absence, projection drift, cross-course IDs, and unauthorized resource exclusion.

## 2. RAG domain split

- [x] 2.1 Define Engineering RAG and Teaching Resource RAG query inputs, result metadata, and citation provenance.
- [x] 2.2 Implement explicit query-time composition without persisting teaching edges to ActKG or mixing versions.
- [x] 2.3 Add representative engineering-only, teaching-only, composed, textbook-locator, and card-fallback tests.

## 3. Konling grounding

- [x] 3.1 Pass bounded prerequisite neighborhoods and linked resources into existing Konling tools/prompts without exposing implementation details.
- [x] 3.2 Preserve domain/Authority/Projection/resource/citation metadata through answer assembly and fallback.

## 4. Verification

- [x] 4.1 Run focused Konling context, graph context, RAG retrieval, citation, authorization, and no-writeback tests.
- [x] 4.2 Run `rtk openspec validate adopt-teaching-projection-in-konling-and-rag --type change --strict` and `rtk openspec validate --changes --strict`.
