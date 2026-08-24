## 1. Version-bound resource context contract

- [x] 1.1 Add focused failing tests for canonical textbook resource identity, unit-level context, registered fragment context, tampered identity fields, and untrusted selection/URL/body hints.
- [x] 1.2 Implement the `structured-textbook-unit` context envelope using `resourceId`, `bookId`, `edition`, `sourceRevision`, `unitId`, `contentHash`, and optional registered `anchorId`.
- [x] 1.3 Add a bounded server-side loader that reauthorizes the current actor, resolves the fixed runtime revision/unit, verifies hash and anchor membership, and returns only server-owned content and citation ids.

## 2. Konling session and citation binding

- [x] 2.1 Extend `resource-coach` readiness and request handling to accept the verified textbook context while treating all client fields as untrusted declarations.
- [x] 2.2 Atomically persist the complete server-verified resource identity in existing conversation state before the first grounded answer, then revalidate authorization, revision, hash, unit, and anchor on every turn without accepting client replay or silently switching to the active revision.
- [x] 2.3 Hydrate clickable citations only from server-owned CitationAddress metadata matching the fixed session identity, using a same-origin version-bound navigation handle or equivalent exact-version target; reject model URLs, unknown ids, tampered/expired handles, cross-resource/version targets, hash drift, and unavailable anchors.
- [x] 2.4 Render explicit unauthorized, version-changed, anchor-unavailable, and unverified-citation states without falling back to generic resource guesses or disclosing protected content.

## 3. Unified textbook reader integration

- [x] 3.1 Add the contextual Konling entry to the unified textbook reader for the current runtime v2 unit and optional registered formula/figure/table fragment.
- [x] 3.2 Keep ordinary paragraph selections as bounded question hints only; do not represent DOM offsets, line numbers, or selected text as stable citation identities.
- [x] 3.3 Keep reader-owned live unit, fragment, scroll, and focus state while the panel is open; closing SHALL preserve direct user scrolling/navigation and verified citation targets, while the opening snapshot may correct only layout-caused displacement when no user position event occurred.
- [x] 3.4 Ensure unavailable or rejected citations do not navigate, remount the reader, or move the current reading position.

## 4. Acceptance and project verification

- [x] 4.1 Add deterministic server/runtime tests for authorized unit context, representative formula/figure/table fragments, field tampering, atomic server-side session binding, mid-session permission revocation, active-revision updates, missing revisions, hash drift, anchor loss, and tampered/expired navigation handles.
- [x] 4.2 Add a dual-revision browser fixture proving an R1 session after R2 activation either renders the exact R1 citation target or refuses navigation without moving the reader; also cover direct scrolling/navigation while the panel is open, no-user-movement layout restoration, close/reopen preservation, keyboard focus, screen-reader labels, and 320px layout.
- [x] 4.3 Add scope-isolation regressions proving lesson-engine ResourceRenderer, STATIC_TEXT, KnowledgeCard, `/knowledge`, PDF, video timeline, and external webpage behavior are unchanged.
- [ ] 4.4 Run focused textbook-reader, Konling runtime, chat-route, citation-presentation and Source Pack tests, then TypeScript, lint, full repository tests, and production build on the final intended revision.
- [x] 4.5 Update `docs/ProjectDescription.md` with the shipped textbook-only scope, trusted-context boundary, version pinning behavior, and explicit unsupported resource types.
- [ ] 4.6 Strictly validate the OpenSpec change, complete Buddy review/PR gates, and record implementation evidence without marking Issue acceptance items from the implementation thread.
