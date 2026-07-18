## 1. Persistence and authorization

- [ ] 1.1 Add Prisma models, enums, indexes, and migration for teacher-owned course bases, immutable document versions, extraction state, and governed projection links.
- [ ] 1.2 Implement owner/admin authorization, sequential versioning, retirement, and referenced-version deletion protection with API tests.

## 2. Ingestion and extraction

- [ ] 2.1 Implement MIME, size, and content-hash validation for Markdown, plain text, pasted text, and searchable PDF inputs.
- [ ] 2.2 Implement normalized Markdown/plain-text extraction with stable paragraph anchors and extraction preview.
- [ ] 2.3 Implement server-side searchable-PDF extraction with page/paragraph anchors and explicit scan-or-empty-text-layer rejection.
- [ ] 2.4 Implement teacher confirm/reject and retry flows without exposing raw private uploads outside owner/admin scope.

## 3. Governed retrieval

- [ ] 3.1 Project confirmed segments into the governed corpus with owner, document-version, citation-target, hash, and lifecycle metadata.
- [ ] 3.2 Extend `lesson-design` Source Pack retrieval for selected teacher-owned versions and verified SAR-expanded candidates without reading raw uploads.
- [ ] 3.3 Add privacy, retirement, anchor-stability, scoped-retrieval, and source-version identity tests.

## 4. Teacher workflow and demonstration

- [ ] 4.1 Build course-basis list, upload/paste, extraction-preview, version-history, and retirement interfaces under `/teacher/smart-prep`.
- [ ] 4.2 Add the compact demonstration course standard, a machine-readable rights/provenance manifest, and an import path that uses the existing Hu Shousong root-locus runtime Markdown only from an authorized teacher-local location or substitutes an independently authorized excerpt.
- [ ] 4.3 Run targeted unit/API tests, migration verification, typecheck, and strict OpenSpec validation; record AC evidence.
