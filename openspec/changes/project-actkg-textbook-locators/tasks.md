## Series Dependencies

- Depends on: `introduce-versioned-act-teaching-projection`.

## 1. Public source inventory

- [x] 1.1 Load the three ActKG SourceDocument/SourceAnchor sets and v0.12 release/capture identities.
- [x] 1.2 Define and validate the minimal `source-resource-crosswalk.jsonl` sidecar without importing textbook正文.

## 2. Textbook projection

- [x] 2.1 Build deterministic book/chapter/section resource IDs and `EXPLAINS` bindings for all valid sidecar rows.
- [x] 2.2 Emit access mode, locator, provenance, Authority/projection identities, and per-row failure reasons.
- [x] 2.3 Add one-to-many/many-to-one, missing sidecar, duplicate anchor, unknown Canonical, and capture-drift fixtures.

## 3. Consumer boundaries

- [x] 3.1 Integrate textbook rows with existing ResourceNode and RAG citation contracts without granting path eligibility or raw-text access.
- [x] 3.2 Prove a sidecar failure blocks only textbook projection and leaves Authority/other teaching resources selectable.

## 4. Verification

- [x] 4.1 Run focused locator, resource-registry, segment-binding, and RAG provenance tests.
- [x] 4.2 Run `rtk openspec validate project-actkg-textbook-locators --type change --strict` and `rtk openspec validate --changes --strict`.
