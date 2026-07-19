## Context

ACT already retrieves governed runtime textbook segments through `lesson-design` Source Packs, but teachers cannot create a private reusable course basis from uploaded standards and textbooks. `pdf-lib` creates PDFs but does not extract text, so searchable-PDF ingestion needs an isolated server adapter.

## Goals / Non-Goals

**Goals:** private course bases, bounded text formats, teacher-reviewed extraction, stable anchors, immutable versions, and governed retrieval projection.

**Non-Goals:** OCR, DOCX/PPTX, lesson generation, public sharing, or direct model access to raw uploads.

## Decisions

### 1. Separate document identity from immutable versions

`CourseBasis` groups reusable sources; `CourseBasisDocument` names a logical standard or textbook; each import creates an immutable `CourseBasisDocumentVersion` with hash, extraction state, anchors, confirmation, and lifecycle. Referenced versions may be retired but not deleted.

### 2. Normalize through a server-owned extraction adapter

Markdown, text, and pasted text produce heading/paragraph anchors. Searchable PDFs produce page/paragraph anchors. Empty text layers fail explicitly and do not invoke OCR. Original and normalized content remain teacher-scoped.

### 3. Require confirmation before governed projection

Only a teacher-confirmed version becomes a governed corpus source. The projection preserves owner scope, version id, stable anchors, hashes, review state, and server-owned citation metadata; generation consumers use Source Pack rather than raw files.

### 4. Exercise demo inputs as ordinary authorized imports

The Hu Shousong chapter-four runtime Markdown/citation segments and a compact standard derived from the syllabus blueprint form a reproducible input set, but the demo must pass through the ordinary import and confirmation flow. A rights/provenance manifest records the permitted use of each source. Restricted textbook text remains in its authorized teacher-local runtime location or is replaced with an independently authorized excerpt rather than copied into the public repository or contest bundle.

## Risks / Trade-offs

- [PDF extraction varies] -> Preview normalized pages/paragraphs and reject unusable text rather than infer content.
- [Private or copyrighted material leaks] -> Enforce owner/admin authorization at storage, API, projection, and retrieval layers.
- [Anchors drift after replacement] -> New content always creates a new immutable version and hash namespace.

## Migration Plan

Add nullable new tables and storage paths, deploy behind the smart-prep feature flag, index only confirmed new sources, and leave existing runtime textbook projections unchanged. Rollback disables ingestion while retaining versions and citations.

## Open Questions

The concrete PDF extraction package and storage backend are implementation selections behind the fixed adapter contract.

## Testing Strategy
Change class: medium-risk
Seam status: required
Public behavior: An owning teacher can import supported standards and textbooks, review stable extracted anchors, confirm immutable versions, and retrieve only those confirmed private versions through lesson-design Source Packs.
Public seam: Teacher course-basis browser flow and public route handlers backed by the real database, extraction fixtures, governed corpus projection, and Source Pack authorization.
Existing seam reused: Existing route authorization tests, Source Pack corpus-adapter tests, Prisma integration fixtures, and Playwright teacher workspace harness.
AC coverage: AC-1: browser and API fixtures verify supported formats, extraction preview, stable anchors, confirmation, and explicit scan-only rejection; AC-2: authorization and version lifecycle tests verify private ownership, immutable replacement, retirement, and deletion protection; AC-3: governed projection, Source Pack, rights-manifest, and restricted-packaging tests verify confirmed-version retrieval and the ordinary authorized demo import path without public redistribution.
Manual-only acceptance: none
Rationale: The browser/API seam observes the complete teacher workflow, while corpus and authorization integration tests verify the same persisted versions and privacy boundaries consumed by later generation children.
